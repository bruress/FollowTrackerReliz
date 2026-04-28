import { parseInputFileName, readInputPosts, saveAnalysis, readResult } from "./file.service.js";
import { calculateNumericMetrics } from "./metrics.service.js";
import { getAccessToken, analyzeAi, buildDefaultAiMetrics } from "./gigachat.service.js";

const LOW_ENGAGEMENT_THRESHOLD = 0.01;

// главную функцию анализа
export async function runAnalysis(fileName) {
    const startedAt = Date.now();

    // service + domain + data + data
    const fileMeta = parseInputFileName(fileName);
    // можем получить токен?
    await getAccessToken();
    // читаем входной файл как есть
    const posts = readInputPosts(fileName);
    // считаем числовые метрики без ai
    const numericMetrics = calculateNumericMetrics(posts);
    // ai-метрики
    const postsWithAi = await analyzeAi(posts, LOW_ENGAGEMENT_THRESHOLD);
    // ai-метрики по всему паблику
    const aiMetrics = buildDefaultAiMetrics(postsWithAi);

    const durationMs = Date.now() - startedAt;

    const result = {
        numericMetrics,
        aiMetrics,
        posts: postsWithAi,
    };

    // сохраняем 
    const { outputFile } = saveAnalysis(fileMeta, result);
    return { outputFile, durationMs };
}

// читаем сохраненный результат по имени файла
export function getSavedAnalysis(resultFileName) {
    return readResult(resultFileName);
}
