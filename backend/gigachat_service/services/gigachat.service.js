import fs from "fs";
import https from "https";
import { GigaChat } from "gigachat";
import { round, calcEngagement } from "../utils/math.util.js";
import { buildError } from "../utils/error.util.js";

const GIGACHAT_API_PERS = process.env.GIGACHAT_API_PERS || "";
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY || "";
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || "GigaChat";
const certPath = String(process.env.CA_CERT_PATH || "").trim();
const BATCH_SIZE = 20;
const BATCH_PAUSE_MS = 0;
const POSTS_PER_REQUEST = 4;
const RETRY_PAUSE_MS = 100;
const MAX_RETRIES = 3;
const TEXT_LIMIT = 500;
const COMMENT_TEXT_LIMIT = 100;
const COMMENT_COUNT_LIMIT = 3;
const DEFAULT_LABELS = {
    toxicity: "low",
    undesirableContent: "none",
    emotionalTone: "neutral",
    uniqueness: "medium",
    semanticSignificance: "medium",
    topCommentsSentiment: "neutral",
};

let token = null;
let tokenUntil = 0;

// создаем https с сертификатом
if (!certPath) {
    throw buildError("Не задан CA_CERT_PATH", "CONFIG_ERROR", 500);
}
if (!fs.existsSync(certPath)) {
    throw buildError("Файл сертификата не найден", "CONFIG_ERROR", 500);
}
const cert = fs.readFileSync(certPath);
const httpsAgent = new https.Agent({ ca: cert });

const client = new GigaChat({
    credentials: GIGACHAT_AUTH_KEY,
    scope: GIGACHAT_API_PERS,
    model: GIGACHAT_MODEL,
    httpsAgent,
    timeout: 40,
});

export async function getAccessToken() {
    if (token && Date.now() < tokenUntil) {
        return token;
    }
    try {
        await client.updateToken();
        const newToken = client._accessToken;
        if (!newToken?.access_token || !newToken?.expires_at) {
            throw buildError("GigaChat вернул пустой токен", "GIGACHAT_EMPTY_TOKEN", 502);
        }
        token = newToken.access_token;
        tokenUntil = Number(newToken.expires_at);
        return token;
    } catch (error) {
        console.error("Ошибка получения токена GigaChat:", error?.message || error);
        if (error?.status) {
            throw error;
        }
        throw buildError("Не удалось получить токен GigaChat", "GIGACHAT_TOKEN_ERROR", 502);
    }
}

export async function analyzeAi(posts, lowEngagementThreshold, includeComments = true) {
    const items = posts;
    const result = [];
    const totalBatches = Math.ceil(items.length/BATCH_SIZE);
    for (let start=0; start<items.length; start+=BATCH_SIZE) {
        const batchNum = Math.floor(start/BATCH_SIZE)+1;
        const postsLeft = items.length-start;
        console.log(`gigachat_service: батч ${batchNum}/${totalBatches}, осталось постов ${postsLeft}`);
        const batch = items.slice(start, start+BATCH_SIZE);
        const batchResult = [];

        for (let j=0; j<batch.length; j+=POSTS_PER_REQUEST) {
            const part = batch.slice(j, j+POSTS_PER_REQUEST);
            let aiList = null;
            for (let attempt=1; attempt<=MAX_RETRIES; attempt+=1) {
                try {
                    const raw = await askAi(
                        "Ты аналитик контента. Отвечай только валидным JSON без markdown. Верни строго JSON-массив по числу постов. В каждом поле возвращай только label.",
                        buildPostsPrompt(part, includeComments),
                    );
                    aiList = parseAiList(raw, part.length, includeComments);
                    break;
                } catch (error) {
                    console.error(`gigachat_service: ошибка AI анализа, попытка ${attempt}/${MAX_RETRIES}`);
                    const status = Number(error?.status || error?.response?.status || 0);
                    if (status === 400 || status === 401 || status === 403 || status === 404) {
                        throw buildError("Критическая ошибка запроса к GigaChat, проверьте модель и доступ", "GIGACHAT_REQUEST_ERROR", 502);
                    }
                    if (attempt<MAX_RETRIES) {
                        const pauseMs = RETRY_PAUSE_MS*attempt;
                        await new Promise((resolve) => setTimeout(resolve, pauseMs));
                    }
                }
            }

            if (!aiList) {
                aiList = Array.from({ length: part.length }, () => defaultAiData(includeComments));
                console.error(`gigachat_service: посты переведены на дефолт после ${MAX_RETRIES} попыток`);
            }

            for (let index=0; index<part.length; index+=1) {
                const post = part[index];
                const aiData = aiList[index] || defaultAiData(includeComments);
                const likes = post?.likes || 0;
                const comments = post?.comments || 0;
                const reposts = post?.reposts || 0;
                const views = post?.views || 0;
                const engagementRate = calcEngagement(likes, comments, reposts, views);
                const flags = {
                    isLowEngagement: engagementRate < lowEngagementThreshold,
                    isPotentiallyToxic: aiData.toxicity.score >= 0.6,
                    isPotentiallyUndesirable: aiData.undesirableContent.score >= 0.6,
                };
                batchResult.push({
                    postId: String(post?.id || ""),
                    postDate: String(post?.date || ""),
                    numeric: {
                        likes,
                        reposts,
                        views,
                        engagementRate,
                    },
                    ai: aiData,
                    flags,
                });
            }
        }
        result.push(...batchResult);
        if (BATCH_PAUSE_MS > 0 && start+BATCH_SIZE<items.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
        }
    }
    return result;
}

function defaultAiData(includeComments) {
    return {
        toxicity: { label: "low", score: 0 },
        undesirableContent: { label: "none", score: 0 },
        emotionalTone: { label: "neutral", score: 0 },
        uniqueness: { label: "medium", score: 0 },
        semanticSignificance: { label: "medium", score: 0 },
        topCommentsSentiment: { label: includeComments ? "neutral" : "none", score: 0 },
    };
}

// отправляем один запрос к gigachat и возвращаем чистый текст
async function askAi(systemText, userText) {
    const response = await client.chat({
        messages: [
            // как себя вести
            { role: "system", content: systemText },
            // задачи, данные
            { role: "user", content: userText },
        ],
        // насколько "творческий" ответ
        temperature: 0.2,
    });
    // возвращаем только текст ответа
    return String(response?.choices?.[0]?.message?.content || "");
}

export function buildDefaultAiMetrics(posts) {
    const toxicityDetection = sumAiScore(posts, "toxicity");
    const undesirableContentDetection = sumAiScore(posts, "undesirableContent");
    const emotionalToneAssessment = sumAiScore(posts, "emotionalTone");
    const uniquenessAssessment = sumAiScore(posts, "uniqueness");
    const semanticSignificanceAssessment = sumAiScore(posts, "semanticSignificance");

    return {
        toxicityDetection,
        undesirableContentDetection,
        emotionalToneAssessment,
        uniquenessAssessment,
        semanticSignificanceAssessment,
    };
}

function buildPostPrompt(post, includeComments) {
    const text = String(post.text || "");
    const clippedText = text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}...` : text;
    const topCommentsText = includeComments ? formatComments(post.topComments) : "none";
    const postId = String(post?.id || "");
    const postDate = String(post?.date || "");
    const likes = post?.likes || 0;
    const comments = post?.comments || 0;
    const reposts = post?.reposts || 0;
    const views = post?.views || 0;

    const engagementRate = calcEngagement(likes, comments, reposts, views);

    const numericLine = `likes=${likes}; comments=${comments}; reposts=${reposts}; views=${views}; engagementRate=${engagementRate}`;
    const lines = [
        "Оцени пост и верни JSON:",
        "{",
        '  "toxicity": {"label":"low|medium|high"},',
        '  "undesirableContent": {"label":"none|low|medium|high"},',
        '  "emotionalTone": {"label":"negative|neutral|positive|mixed"},',
        '  "uniqueness": {"label":"low|medium|high"},',
        '  "semanticSignificance": {"label":"low|medium|high"},',
        includeComments
            ? '  "topCommentsSentiment": {"label":"negative|neutral|positive|mixed"},'
            : '  "topCommentsSentiment": {"label":"none"}',
        "}",
        `postId=${postId}`,
        `postDate=${postDate}`,
        numericLine,
        `text=${clippedText}`,
        `topComments=${topCommentsText}`,
    ];
    return lines.join("\n");
}

function buildPostsPrompt(posts, includeComments) {
    const parts = [
        "Оцени каждый пост и верни JSON-массив.",
        "Структура каждого элемента:",
        '{"toxicity":{"label":"low|medium|high"},"undesirableContent":{"label":"none|low|medium|high"},"emotionalTone":{"label":"negative|neutral|positive|mixed"},"uniqueness":{"label":"low|medium|high"},"semanticSignificance":{"label":"low|medium|high"},"topCommentsSentiment":{"label":"negative|neutral|positive|mixed|none"}}',
        `Количество элементов массива = ${posts.length}`,
    ];
    for (let i=0; i<posts.length; i+=1) {
        parts.push(`POST_${i+1}`);
        parts.push(buildPostPrompt(posts[i], includeComments));
    }
    return parts.join("\n");
}

function parseAiList(raw, expectedCount, includeComments) {
    const parsed = parseAiPayload(raw);
    if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
        throw buildError("GigaChat вернул невалидный JSON-массив", "GIGACHAT_INVALID_JSON", 502);
    }
    const list = [];
    for (const item of parsed) {
        list.push(normalizeAi(item, includeComments));
    }
    return list;
}

function normalizeAi(parsed, includeComments) {
    const ai = {
        toxicity: normalizeScore(parsed?.toxicity, "low", ["low", "medium", "high"]),
        undesirableContent: normalizeScore(parsed?.undesirableContent, "none", ["none", "low", "medium", "high"]),
        emotionalTone: normalizeScore(parsed?.emotionalTone, "neutral", ["negative", "neutral", "positive", "mixed"]),
        uniqueness: normalizeScore(parsed?.uniqueness, "medium", ["low", "medium", "high"]),
        semanticSignificance: normalizeScore(parsed?.semanticSignificance, "medium", ["low", "medium", "high"]),
        topCommentsSentiment: normalizeScore(parsed?.topCommentsSentiment, "neutral", ["negative", "neutral", "positive", "mixed", "none"]),
    };
    if (!includeComments) {
        ai.topCommentsSentiment = { label: "none", score: 0 };
    }
    return ai;
}

function parseAiPayload(raw) {
    const text = String(raw || "").trim();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const jsonChunk = text.slice(firstBrace, lastBrace+1);
            try {
                return JSON.parse(jsonChunk);
            } catch {
                return null;
            }
        }
        return null;
    }
}

function formatComments(topComments) {
    if (!Array.isArray(topComments) || topComments.length === 0) {
        return "none";
    }
    const lines = [];

    for (let i=0; i<topComments.length; i+=1) {
        if (lines.length >= COMMENT_COUNT_LIMIT) {
            break;
        }
        const item = topComments[i];
        const text = String(item?.text || "").trim();
        if (!text) {
            continue;
        }
        const clipped = text.length > COMMENT_TEXT_LIMIT ? `${text.slice(0, COMMENT_TEXT_LIMIT)}...` : text;
        lines.push(`${i+1}) ${clipped}`);
    }
    return lines.length > 0 ? lines.join(" | ") : "none";
}

function normalizeScore(value, defaultLabel, allowedLabels) {
    const rawLabel = String(value?.label || defaultLabel).toLowerCase();
    const label = allowedLabels.includes(rawLabel) ? rawLabel : defaultLabel;
    return {
        label,
        score: scoreByLabel(label),
    };
}

function scoreByLabel(label) {
    if (label === "none") {
        return 0;
    }
    if (label === "low" || label === "negative") {
        return 0.25;
    }
    if (label === "neutral" || label === "mixed" || label === "medium") {
        return 0.5;
    }
    if (label === "positive") {
        return 0.75;
    }
    if (label === "high") {
        return 1;
    }
    return 0.5;
}

function sumAiScore(posts, key) {
    const defaultLabel = defaultLabelKey(key);
    if (posts.length === 0) {
        return { label: defaultLabel, score: 0 };
    }
    const labelsCount = {};
    let sum = 0;
    for (const post of posts) {
        const metric = post.ai?.[key] || { label: defaultLabel, score: 0 };
        const label = String(metric.label || defaultLabel);
        labelsCount[label] = (labelsCount[label] || 0)+1;
        sum += scoreByLabel(label);
    }

    const topLabel = Object.entries(labelsCount).sort((a, b) => b[1]-a[1])[0]?.[0] || defaultLabel;

    return {
        label: topLabel,
        score: round(sum/posts.length),
    };
}

function defaultLabelKey(key) {
    return DEFAULT_LABELS[key] || "medium";
}
