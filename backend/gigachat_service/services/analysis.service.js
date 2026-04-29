import { parseInputFileName, readInputPosts, saveAnalysis, readResult } from "./file.service.js";
import { calculateNumericMetrics } from "./metrics.service.js";
import { getAccessToken, analyzeAi, buildDefaultAiMetrics } from "./gigachat.service.js";
import { buildError } from "../utils/error.util.js";


export async function runAnalysis(fileName) {
    const startedAt = Date.now();
    const fileMeta = parseInputFileName(fileName);
    if (!fileMeta) {
        throw buildError("Некорректное имя входного файла", 400, "INVALID_FILE_NAME");
    }
    await getAccessToken();
    const posts = await readInputPosts(fileName);
    const numericMetrics = calculateNumericMetrics(posts);
    const postsWithAi = await analyzeAi(posts, 0.01);
    const aiMetrics = buildDefaultAiMetrics(postsWithAi);

    const durationMs = Date.now() - startedAt;

    const result = {
        numericMetrics,
        aiMetrics,
        posts: postsWithAi,
    };

    const { outputFile } = await saveAnalysis(fileMeta, result);
    return { outputFile, durationMs };
}

export async function getSavedAnalysis(resultFileName) {
    return await readResult(resultFileName);
}
