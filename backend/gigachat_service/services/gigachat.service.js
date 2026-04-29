import fs from "fs";
import https from "https";
import { GigaChat } from "gigachat";
import { round, calcEngagement } from "../utils/math.util.js";
import { buildError } from "../utils/error.util.js";

const GIGACHAT_API_PERS = process.env.GIGACHAT_API_PERS || "";
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY || "";
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || "GigaChat";
const certPath = String(process.env.CA_CERT_PATH || "").trim();

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
    timeout: 60,
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

export async function analyzeAi(posts, lowEngagementThreshold) {
    const items = posts;
    const result = [];
    const aiLimit = Math.max(0, Math.min(items.length, 30));

    for (let i=0; i<items.length; i+=1) {
        const post = items[i];
        let aiData = {
            toxicity: { label: "unknown", score: 0 },
            undesirableContent: { label: "unknown", score: 0 },
            emotionalTone: { label: "unknown", score: 0 },
            uniqueness: { label: "unknown", score: 0 },
            semanticSignificance: { label: "unknown", score: 0 },
            topCommentsSentiment: { label: "unknown", score: 0 },
            topCommentsTopicEngagement: { label: "unknown", score: 0 },
        };

        // если пост входит в лимит
        if (i<aiLimit) {
            try {
                const prompt = buildPostPrompt(post);
                const raw = await askAi(
                    "Ты аналитик контента. Отвечай только валидным JSON без markdown. В score пиши только число 0..1, например 0.25, не .25 и не текст.",
                    prompt,
                );
                aiData = parseAi(raw);
            } catch (error) {
                void error;
            }
        }

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

        result.push({
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
    return result;
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

function buildPostPrompt(post) {
    const text = String(post.text || "");
    const clippedText = text.length > 1500 ? `${text.slice(0, 1500)}...` : text;
    const topCommentsText = formatComments(post.topComments);
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

function parseAi(raw) {
    const parsed = JSON.parse(String(raw || "{}"));

    return {
        toxicity: normalizeScore(parsed?.toxicity, "low"),
        undesirableContent: normalizeScore(parsed?.undesirableContent, "none"),
        emotionalTone: normalizeScore(parsed?.emotionalTone, "neutral"),
        uniqueness: normalizeScore(parsed?.uniqueness, "medium"),
        semanticSignificance: normalizeScore(parsed?.semanticSignificance, "medium"),
        topCommentsSentiment: normalizeScore(parsed?.topCommentsSentiment, "neutral"),
        topCommentsTopicEngagement: normalizeScore(parsed?.topCommentsTopicEngagement, "medium"),
    };
}

function formatComments(topComments) {
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

function normalizeScore(value, defaultLabel) {
    return {
        label: String(value?.label || defaultLabel),
        score: scoreValue(value?.score),
    };
}

function scoreValue(value) {
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
        if (label !== "unknown") {
            labelsCount[label] = (labelsCount[label] || 0)+1;
        }
        sum += scoreValue(metric.score);
    }

    const topLabel = Object.entries(labelsCount).sort((a, b) => b[1]-a[1])[0]?.[0] || defaultLabel;

    return {
        label: topLabel,
        score: round(sum/posts.length),
    };
}

function defaultLabelKey(key) {
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
