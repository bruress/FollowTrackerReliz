import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { GigaChat } from "gigachat";
import { round, calcEngagementRate } from "../utils/math.util.js";
import { buildError } from "../utils/error.util.js";

const GIGACHAT_API_PERS = process.env.GIGACHAT_API_PERS || "";
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY || "";
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || "GigaChat";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ROOT = path.resolve(__dirname, "..");
const CA_CERT_PATH_RAW = String(process.env.CA_CERT_PATH || "").trim();
const CA_CERT_PATH = path.isAbsolute(CA_CERT_PATH_RAW)
    ? CA_CERT_PATH_RAW
    : path.resolve(SERVICE_ROOT, CA_CERT_PATH_RAW);
const MAX_AI_POSTS = 30;

let accessToken = null;
let tokenExpiresAt = 0;

// создаем https с сертификатом
if (!CA_CERT_PATH_RAW) {
    throw buildError("Не задан CA_CERT_PATH", 500, "CONFIG_ERROR");
}
if (!fs.existsSync(CA_CERT_PATH)) {
    throw buildError("Файл сертификата не найден", 500, "CONFIG_ERROR");
}
const cert = fs.readFileSync(CA_CERT_PATH);
const httpsAgent = new https.Agent({ ca: cert });

const gigaChatClient = new GigaChat({
    credentials: GIGACHAT_AUTH_KEY,
    scope: GIGACHAT_API_PERS,
    model: GIGACHAT_MODEL,
    httpsAgent,
    timeout: 60,
});

export async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }
    try {
        await gigaChatClient.updateToken();
        const tokenFresh = gigaChatClient._accessToken;
        if (!tokenFresh?.access_token || !tokenFresh?.expires_at) {
            throw buildError("GigaChat вернул пустой токен", 502, "GIGACHAT_EMPTY_TOKEN");
        }
        accessToken = tokenFresh.access_token;
        tokenExpiresAt = Number(tokenFresh.expires_at);
        return accessToken;
    } catch (error) {
        console.error("Ошибка получения токена GigaChat:", error?.message || error);
        if (error?.status) {
            throw error;
        }
        throw buildError("Не удалось получить токен GigaChat", 502, "GIGACHAT_TOKEN_ERROR");
    }
}

export async function analyzeAi(posts, lowEngagementThreshold) {
    const list = Array.isArray(posts) ? posts : [];
    const result = [];
    const cnt = Math.max(0, Math.min(list.length, MAX_AI_POSTS));

    for (let i=0; i<list.length; i+=1) {
        const post = list[i];
        let ai = {
            toxicity: { label: "unknown", score: 0 },
            undesirableContent: { label: "unknown", score: 0 },
            emotionalTone: { label: "unknown", score: 0 },
            uniqueness: { label: "unknown", score: 0 },
            semanticSignificance: { label: "unknown", score: 0 },
            topCommentsSentiment: { label: "unknown", score: 0 },
            topCommentsTopicEngagement: { label: "unknown", score: 0 },
        };

        // если пост входит в лимит
        if (i<cnt) {
            try {
                const prompt = buildPostPrompt(post);
                const raw = await askModel(
                    "Ты аналитик контента. Отвечай только валидным JSON без markdown. В score пиши только число 0..1, например 0.25, не .25 и не текст.",
                    prompt,
                );
                ai = parsePostAiJson(raw);
            } catch (error) {
                void error;
            }
        }

        const likes = post?.likes || 0;
        const comments = post?.comments || 0;
        const reposts = post?.reposts || 0;
        const views = post?.views || 0;

        const engagementRate = calcEngagementRate(likes, comments, reposts, views);

        const flags = {
            isLowEngagement: engagementRate < lowEngagementThreshold,
            isPotentiallyToxic: ai.toxicity.score >= 0.6,
            isPotentiallyUndesirable: ai.undesirableContent.score >= 0.6,
        };

        result.push({
            postId: String(post?.id || ""),
            postDate: String(post?.date || ""),
            numeric: {
                likes,
                reposts,
                views,
                engagementRate,
            },
            ai,
            flags,
        });
    }
    return result;
}

// отправляем один запрос к gigachat и возвращаем чистый текст
async function askModel(systemText, userText) {
    const response = await gigaChatClient.chat({
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
    const toxicityDetection = aggregateAiScore(posts, "toxicity");
    const undesirableContentDetection = aggregateAiScore(posts, "undesirableContent");
    const emotionalToneAssessment = aggregateAiScore(posts, "emotionalTone");
    const uniquenessAssessment = aggregateAiScore(posts, "uniqueness");
    const semanticSignificanceAssessment = aggregateAiScore(posts, "semanticSignificance");

    return {
        toxicityDetection,
        undesirableContentDetection,
        emotionalToneAssessment,
        uniquenessAssessment,
        semanticSignificanceAssessment,
    };
}

function buildPostPrompt(post) {
    const text = String(post.text || "");
    const clippedText = text.length > 1500 ? `${text.slice(0, 1500)}...` : text;
    const topCommentsText = formatTopComments(post.topComments);
    const postId = String(post?.id || "");
    const postDate = String(post?.date || "");
    const likes = post?.likes || 0;
    const comments = post?.comments || 0;
    const reposts = post?.reposts || 0;
    const views = post?.views || 0;

    const engagementRate = calcEngagementRate(likes, comments, reposts, views);

    const numericLine = `likes=${likes}; comments=${comments}; reposts=${reposts}; views=${views}; engagementRate=${engagementRate}`;
    const lines = [
        "Оцени пост и верни JSON:",
        "{",
        '  "toxicity": {"label":"low|medium|high","score":0..1},',
        '  "undesirableContent": {"label":"none|low|medium|high","score":0..1},',
        '  "emotionalTone": {"label":"negative|neutral|positive|mixed","score":0..1},',
        '  "uniqueness": {"label":"low|medium|high","score":0..1},',
        '  "semanticSignificance": {"label":"low|medium|high","score":0..1},',
        '  "topCommentsSentiment": {"label":"negative|neutral|positive|mixed","score":0..1},',
        '  "topCommentsTopicEngagement": {"label":"low|medium|high","score":0..1}',
        "}",
        `postId=${postId}`,
        `postDate=${postDate}`,
        numericLine,
        `text=${clippedText}`,
        `topComments=${topCommentsText}`,
    ];
    return lines.join("\n");
}

function parsePostAiJson(raw) {
    const parsed = JSON.parse(String(raw || "{}"));

    return {
        toxicity: normalizeLabelScore(parsed?.toxicity, "low"),
        undesirableContent: normalizeLabelScore(parsed?.undesirableContent, "none"),
        emotionalTone: normalizeLabelScore(parsed?.emotionalTone, "neutral"),
        uniqueness: normalizeLabelScore(parsed?.uniqueness, "medium"),
        semanticSignificance: normalizeLabelScore(parsed?.semanticSignificance, "medium"),
        topCommentsSentiment: normalizeLabelScore(parsed?.topCommentsSentiment, "neutral"),
        topCommentsTopicEngagement: normalizeLabelScore(parsed?.topCommentsTopicEngagement, "medium"),
    };
}

function formatTopComments(topComments) {
    if (!Array.isArray(topComments) || topComments.length === 0) {
        return "none";
    }
    const lines = [];

    for (let i=0; i<topComments.length; i+=1) {
        const item = topComments[i];
        const text = String(item?.text || "").trim();
        if (!text) {
            continue;
        }
        const clipped = text.length > 300 ? `${text.slice(0, 300)}...` : text;
        lines.push(`${i+1}) ${clipped}`);
    }
    return lines.length > 0 ? lines.join(" | ") : "none";
}

function normalizeLabelScore(value, defaultLabel) {
    return {
        label: String(value?.label || defaultLabel),
        score: Score(value?.score),
    };
}

function Score(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) {
        return 0;
    }
    if (score<0) {
        return 0;
    }
    if (score>1) {
        return 1;
    }
    return round(score);
}

function aggregateAiScore(posts, key) {
    const defaultLabel = getDefaultLabelByKey(key);
    if (!Array.isArray(posts) || posts.length === 0) {
        return { label: defaultLabel, score: 0 };
    }
    const labelsCount = {};
    let sum = 0;
    for (const post of posts) {
        const metric = post.ai?.[key] || { label: defaultLabel, score: 0 };
        const label = String(metric.label || defaultLabel);
        if (label !== "unknown") {
            labelsCount[label] = (labelsCount[label] || 0)+1;
        }
        sum += Score(metric.score);
    }

    const topLabel = Object.entries(labelsCount).sort((a, b) => b[1]-a[1])[0]?.[0] || defaultLabel;

    return {
        label: topLabel,
        score: round(sum/posts.length),
    };
}

function getDefaultLabelByKey(key) {
    if (key === "toxicity") {
        return "low";
    }
    if (key === "undesirableContent") {
        return "none";
    }
    if (key === "emotionalTone") {
        return "neutral";
    }
    if (key === "uniqueness") {
        return "medium";
    }
    if (key === "semanticSignificance") {
        return "medium";
    }
    if (key === "topCommentsSentiment") {
        return "neutral";
    }
    if (key === "topCommentsTopicEngagement") {
        return "medium";
    }
    return "medium";
}
