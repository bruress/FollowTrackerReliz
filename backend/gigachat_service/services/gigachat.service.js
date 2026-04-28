// [fs] - импорт для чтения сертификата
// [https] - импорт для создания https агента
// [GigaChat] - импорт официального клиента gigachat
import fs from "fs";
import https from "https";
import { GigaChat } from "gigachat";
import { round, calcEngagementRate } from "../utils/math.js";
import { buildError } from "../utils/error.js";

// подключение gigachat
const GIGACHAT_API_PERS = process.env.GIGACHAT_API_PERS || "";
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY || "";
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || "GigaChat";
// подключение сертификата Минцифы
const CA_CERT_PATH = process.env.CA_CERT_PATH || "";
// лимит постов для ai анализа
const MAX_AI_POSTS = 30;
// размер батча для параллельной отправки в gigachat
const AI_BATCH_SIZE = 4;

let accessToken = null;
let tokenExpiresAt = 0;

// создаем https с сертификатом
const cert = fs.readFileSync(CA_CERT_PATH);
const httpsAgent = new https.Agent({ ca: cert });

// создаем единый клиент на весь сервис
const gigaChatClient = new GigaChat({
    credentials: GIGACHAT_AUTH_KEY,
    scope: GIGACHAT_API_PERS,
    model: GIGACHAT_MODEL,
    httpsAgent,
    timeout: 60,
});

// получаем токен и кешируем его до expires_at
export async function getAccessToken() {
    // если токен еще жив, сразу возвращаем его
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    try {
        // просим клиент обновить токен
        await gigaChatClient.updateToken();
        // берем токен из клиента
        const tokenFresh = gigaChatClient._accessToken;
        // если токен или время истечения не пришли
        if (!tokenFresh?.access_token || !tokenFresh?.expires_at) {
            throw buildError("GigaChat вернул пустой токен", 502, "GIGACHAT_EMPTY_TOKEN");
        }

        // обновляем токен
        accessToken = tokenFresh.access_token;
        tokenExpiresAt = Number(tokenFresh.expires_at);

        // возвращаем токен
        return accessToken;
    // ловим ошибку
    } catch (error) {
        console.error("Ошибка получения токена GigaChat:", error?.message || error);
        if (error?.status) {
            throw error;
        }
        throw buildError("Не удалось получить токен GigaChat", 502, "GIGACHAT_TOKEN_ERROR");
    }
}

// считаем ai по постам
export async function analyzeAi(posts, lowEngagementThreshold) {
    // проверяем, что пришел массив
    const list = Array.isArray(posts) ? posts : [];
    // считаем лимит постов
    const cnt = Math.max(0, Math.min(list.length, MAX_AI_POSTS));
    // здесь храним ai-результаты по индексу поста
    const aiByIndex = new Array(list.length).fill(null);

    // идем по постам батчами и запускаем запросы параллельно
    for (let batchStart = 0; batchStart < cnt; batchStart += AI_BATCH_SIZE) {
        // правая граница текущего батча
        const batchEnd = Math.min(batchStart + AI_BATCH_SIZE, cnt);
        // индекс каждого поста из батча
        const indexes = [];
        for (let i = batchStart; i < batchEnd; i += 1) {
            indexes.push(i);
        }

        // параллельная отправка запросов текущего батча
        await Promise.all(indexes.map(async (i) => {
            try {
                // берем текущий пост
                const post = list[i];
                // собираем промт для текущего поста
                const prompt = buildPostPrompt(post);
                // отправляем запрос в модель и получаем сырой ответ
                const raw = await askModel(
                    "Ты аналитик контента. Отвечай только валидным JSON без markdown. В score пиши только число 0..1, например 0.25, не .25 и не текст.",
                    prompt,
                );
                // парсим ответ и сохраняем по индексу поста
                aiByIndex[i] = parsePostAiJson(raw);
            //  ошибка
            } catch (error) {
                void error;
            }
        }));
    }
    // массив для готовых постов
    const result = [];

    // цикл по всем постам
    for (let i=0; i<list.length; i+=1) {
        // берем текущий пост
        const post = list[i];
        // пустой ai блок по умолчанию
        let ai = {
            toxicity: { label: "unknown", score: 0 },
            undesirableContent: { label: "unknown", score: 0 },
            emotionalTone: { label: "unknown", score: 0 },
            uniqueness: { label: "unknown", score: 0 },
            semanticSignificance: { label: "unknown", score: 0 },
            topCommentsSentiment: { label: "unknown", score: 0 },
            topCommentsTopicEngagement: { label: "unknown", score: 0 },
        };

        // если у поста есть готовый ai-результат, подставляем его
        if (aiByIndex[i]) {
            ai = aiByIndex[i];
        }
        // читаем числовые поля поста
        const likes = post?.likes || 0;
        const comments = post?.comments || 0;
        const reposts = post?.reposts || 0;
        const views = post?.views || 0;
        // считаем вовлеченность поста
        const engagementRate = calcEngagementRate(likes, comments, reposts, views);

        // собираем флаги для итогового json
        const flags = {
            // отмечаем низкую вовлеченность
            isLowEngagement: engagementRate < lowEngagementThreshold,
            // обновляем токсичность
            isPotentiallyToxic: ai.toxicity.score >= 0.6,
            // обновляем нежелательный контент
            isPotentiallyUndesirable: ai.undesirableContent.score >= 0.6,
        };

        // добавляем пост в результат
        result.push({
            // сохраняем id поста
            postId: String(post?.id || ""),
            // сохраняем дату поста
            postDate: String(post?.date || ""),
            // сохраняем числовые метрики поста
            numeric: {
                likes,
                reposts,
                views,
                engagementRate,
            },
            // кладем рассчитанный ai блок
            ai,
            // кладем обновленные флаги
            flags,
        });
    }
    // возвращаем итоговый массив постов
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

// собираем дефолтные ai метрики
export function buildDefaultAiMetrics(posts) {
    // уровень метрик с уровня постов на уровень группы
    const toxicityDetection = aggregateAiScore(posts, "toxicity");
    const undesirableContentDetection = aggregateAiScore(posts, "undesirableContent");
    const emotionalToneAssessment = aggregateAiScore(posts, "emotionalTone");
    const uniquenessAssessment = aggregateAiScore(posts, "uniqueness");
    const semanticSignificanceAssessment = aggregateAiScore(posts, "semanticSignificance");

    // возвращаем единый объект всех метрик
    return {
        // итогово по группе: токсичность
        toxicityDetection,
        // агрегированный нежелательный контент
        undesirableContentDetection,
        // агрегированный эмоциональный тон
        emotionalToneAssessment,
        // итогово по группе: уникальность
        uniquenessAssessment,
        // итогово по группе: семантическая значимость
        semanticSignificanceAssessment,
    };
}

// собираем prompt для анализа одного поста
function buildPostPrompt(post) {
    // берем текст поста и приводим к строке
    const text = String(post.text || "");
    // если текст длинный, обрезаем его до 1500 символов
    const clippedText = text.length > 1500 ? `${text.slice(0, 1500)}...` : text;
    // превращаем массив top comments в короткую строку
    const topCommentsText = formatTopComments(post.topComments);
    // читаем id и дату поста
    const postId = String(post?.id || "");
    const postDate = String(post?.date || "");
    // читаем числа поста
    const likes = post?.likes || 0;
    const comments = post?.comments || 0;
    const reposts = post?.reposts || 0;
    const views = post?.views || 0;

    const engagementRate = calcEngagementRate(likes, comments, reposts, views);

    // собираем строку с числами вовлеченности для промпта
    const numericLine = `likes=${likes}; comments=${comments}; reposts=${reposts}; views=${views}; engagementRate=${engagementRate}`;
    // собираем все строки промпта в массив
    const lines = [
        "Оцени пост и верни JSON:",
        "{",
        // просим оценку токсичности
        '  "toxicity": {"label":"low|medium|high","score":0..1},',
        // просим оценку нежелательного контента
        '  "undesirableContent": {"label":"none|low|medium|high","score":0..1},',
        // просим оценку эмоционального тона
        '  "emotionalTone": {"label":"negative|neutral|positive|mixed","score":0..1},',
        // просим оценку уникальности текста
        '  "uniqueness": {"label":"low|medium|high","score":0..1},',
        // просим оценку семантической значимости
        '  "semanticSignificance": {"label":"low|medium|high","score":0..1},',
        // просим оценку тона top comments
        '  "topCommentsSentiment": {"label":"negative|neutral|positive|mixed","score":0..1},',
        // просим оценку связи top comments с темой поста
        '  "topCommentsTopicEngagement": {"label":"low|medium|high","score":0..1}',
        "}",
        // передаем id поста
        `postId=${postId}`,
        // передаем дату поста
        `postDate=${postDate}`,
        // передаем числовые метрики поста одной строкой
        numericLine,
        // передаем текст поста
        `text=${clippedText}`,
        // передаем top comments
        `topComments=${topCommentsText}`,
    ];

    // склеиваем массив в один промт
    return lines.join("\n");
}

// приводим ответ модели к нужному формату поста
function parsePostAiJson(raw) {
    const parsed = JSON.parse(String(raw || "{}"));
    // {label, score}
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

// готовим комментарии в короткий текст для prompt
function formatTopComments(topComments) {
    // если комментариев нет, отдаем специальный маркер
    if (!Array.isArray(topComments) || topComments.length === 0) {
        return "none";
    }

    // сюда собираем готовые строки комментариев
    const lines = [];

    // проходим по каждому top comment
    for (let i=0; i<topComments.length; i+=1) {
        // берем текущий комментарий
        const item = topComments[i];
        // получаем текст и убираем лишние пробелы
        const text = String(item?.text || "").trim();

        // пропускаем пустые комментарии
        if (!text) {
            continue;
        }

        // ограничиваем длину одного комментария
        const clipped = text.length > 300 ? `${text.slice(0, 300)}...` : text;
        // добавляем строку с порядковым номером
        lines.push(`${i+1}) ${clipped}`);
    }

    // если после фильтрации что-то осталось, склеиваем в одну строку
    return lines.length > 0 ? lines.join(" | ") : "none";
}

function normalizeLabelScore(value, defaultLabel) {
    // приводим к единому виду
    return {
        label: String(value?.label || defaultLabel),
        score: Score(value?.score),
    };
}

// ограничиваем score диапазоном 0..1
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

// считаем средний score и самый частый label по ключу
function aggregateAiScore(posts, key) {
    const defaultLabel = getDefaultLabelByKey(key);

    // если постов нет
    if (!Array.isArray(posts) || posts.length === 0) {
        return { label: defaultLabel, score: 0 };
    }

    const labelsCount = {};
    let sum = 0;

    // идем по постам и собираем статистику по нужному ключу
    for (const post of posts) {
        const metric = post.ai?.[key] || { label: defaultLabel, score: 0 };
        const label = String(metric.label || defaultLabel);
        // unknown - скип
        if (label !== "unknown") {
            labelsCount[label] = (labelsCount[label] || 0)+1;
        }
        sum += Score(metric.score);
    }

    // самый частый label
    const topLabel = Object.entries(labelsCount).sort((a, b) => b[1]-a[1])[0]?.[0] || defaultLabel;

    return {
        label: topLabel,
        score: round(sum/posts.length),
    };
}

// дефолтный label
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
