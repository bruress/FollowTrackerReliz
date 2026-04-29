import { parseFileName, readPosts, saveResult, readSavedResult } from "./file.service.js";
import { calculateMetrics } from "./metrics.service.js";
import { getAccessToken, analyzeAi, buildDefaultAiMetrics } from "./gigachat.service.js";
import { buildError } from "../utils/error.util.js";

export async function runAnalysis(fileName) {
    const startedAt = Date.now();
    const fileMeta = parseFileName(fileName);
    if (!fileMeta) {
        throw buildError("Некорректное имя входного файла", "VALIDATION_ERROR", 400);
    }
    await getAccessToken();
    const posts = await readPosts(fileName);
    const numericMetrics = calculateMetrics(posts);
    const postsWithAi = await analyzeAi(posts, 0.01);
    const aiMetrics = buildDefaultAiMetrics(postsWithAi);

    const durationMs = Date.now()-startedAt;

    const result = {
        numericMetrics,
        aiMetrics,
        posts: postsWithAi,
    };

    const { outputFile } = await saveResult(fileMeta, result);
    return { outputFile, durationMs };
}

export async function getSavedAnalysis(resultFileName) {
    return readSavedResult(resultFileName);
}
