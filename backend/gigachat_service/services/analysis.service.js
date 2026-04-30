import { parseFileName, readPosts, saveResult, readSavedResult, listSavedFiles } from "./file.service.js";
import { calculateMetrics } from "./metrics.service.js";
import { getAccessToken, analyzeAi, buildDefaultAiMetrics } from "./gigachat.service.js";
import { buildError } from "../utils/error.util.js";
import { round } from "../utils/math.util.js";

const analysisCache = new Map();
const LOW_ENGAGEMENT_THRESHOLD = 0.01;

export async function runAnalysis(fileName) {
    const startedAt = Date.now();
    const fileMeta = parseFileName(fileName);
    if (!fileMeta) {
        throw buildError("Некорректное имя входного файла", "VALIDATION_ERROR", 400);
    }
    const fromDate = new Date(fileMeta.firstDate);
    const toDate = new Date(fileMeta.secondDate);
    const outputFile = `analysis_${fileMeta.apiService}_${fileMeta.domain}_${fileMeta.firstDate}_${fileMeta.secondDate}_month_${fileMeta.monthFlag}_comments_${fileMeta.commentsFlag}.json`;
    try {
        await readSavedResult(outputFile);
        return { outputFile, durationMs: Date.now()-startedAt };
    } catch {}
    const posts = await readPosts(fileName);
    const numericMetrics = calculateMetrics(posts);
    const includeComments = fileMeta.commentsFlag === "1";
    const knownByKey = new Map();
    const fileList = await listSavedFiles();
    const candidateFiles = [];
    for (const savedFileName of fileList) {
        if (!savedFileName.startsWith("analysis_")) {
            continue;
        }
        const baseFileName = savedFileName.slice(9);
        const savedMeta = parseFileName(baseFileName);
        if (!savedMeta) {
            continue;
        }
        if (savedMeta.apiService !== fileMeta.apiService || savedMeta.domain !== fileMeta.domain) {
            continue;
        }
        if (includeComments && savedMeta.commentsFlag !== "1") {
            continue;
        }
        const savedFrom = new Date(savedMeta.firstDate);
        const savedTo = new Date(savedMeta.secondDate);
        if (savedTo < fromDate || savedFrom > toDate) {
            continue;
        }
        candidateFiles.push(savedFileName);
    }

    const savedResults = await Promise.all(candidateFiles.map(async (savedFileName) => {
        if (analysisCache.has(savedFileName)) {
            return analysisCache.get(savedFileName);
        }
        try {
            const savedResult = await readSavedResult(savedFileName);
            analysisCache.set(savedFileName, savedResult);
            return savedResult;
        } catch {
            return null;
        }
    }));

    for (const savedResult of savedResults) {
        if (!savedResult) {
            continue;
        }
        const savedPosts = Array.isArray(savedResult?.posts) ? savedResult.posts : [];
        for (const post of savedPosts) {
            const key = postKey(post?.postId, post?.postDate);
            if (knownByKey.has(key)) {
                continue;
            }
            if (!includeComments) {
                const prepared = {
                    ...post,
                    ai: {
                        ...(post?.ai || {}),
                        topCommentsSentiment: { label: "none", score: 0 },
                    },
                };
                knownByKey.set(key, prepared);
            } else {
                knownByKey.set(key, post);
            }
        }
    }

    const unknownPosts = [];
    const postsWithAi = [];
    for (const post of posts) {
        const key = postKey(post?.id, post?.date);
        const known = knownByKey.get(key);
        if (known) {
            postsWithAi.push(known);
        } else {
            unknownPosts.push(post);
        }
    }

    if (unknownPosts.length > 0) {
        await getAccessToken();
        const newAiPosts = await analyzeAi(unknownPosts, LOW_ENGAGEMENT_THRESHOLD, includeComments);
        postsWithAi.push(...newAiPosts);
    }

    postsWithAi.sort((a, b) => {
        const left = String(a?.postDate || "");
        const right = String(b?.postDate || "");
        if (left === right) {
            return Number(b?.postId || 0)-Number(a?.postId || 0);
        }
        return left < right ? 1 : -1;
    });
    const sourceByKey = new Map();
    for (const post of posts) {
        sourceByKey.set(postKey(post?.id, post?.date), post);
    }
    fillPostMetrics(postsWithAi, sourceByKey);
    const aiMetrics = buildDefaultAiMetrics(postsWithAi);
    const result = {
        numericMetrics,
        aiMetrics,
        posts: postsWithAi,
    };

    const saved = await saveResult(fileMeta, result);
    const durationMs = Date.now()-startedAt;
    return { outputFile: saved.outputFile, durationMs };
}

export async function getSavedAnalysis(resultFileName) {
    return readSavedResult(resultFileName);
}

function postKey(postId, postDate) {
    return `${String(postId || "")}__${String(postDate || "")}`;
}

function fillPostMetrics(postsWithAi, sourceByKey) {
    let totalViews = 0;
    const reactions = [];

    for (let i=0; i<postsWithAi.length; i+=1) {
        const post = postsWithAi[i];
        const source = sourceByKey.get(postKey(post?.postId, post?.postDate));
        const likes = Number(post?.numeric?.likes ?? source?.likes ?? 0);
        const comments = Number(post?.numeric?.comments ?? source?.comments ?? 0);
        const reposts = Number(post?.numeric?.reposts ?? source?.reposts ?? 0);
        const views = Number(post?.numeric?.views ?? source?.views ?? 0);
        const total = likes+comments+reposts;
        totalViews += views;
        reactions.push(total);
        post.numeric = {
            ...post.numeric,
            likes,
            comments,
            reposts,
            views,
            averageReactions: total,
            responseIntensity: likes+comments*2+reposts*3,
        };
    }

    for (let i=0; i<postsWithAi.length; i+=1) {
        const current = reactions[i];
        const previous = i+1<reactions.length ? reactions[i+1] : current;
        postsWithAi[i].numeric.dynamicActivity = previous>0 ? round((current-previous)/previous) : 0;
        postsWithAi[i].numeric.reachRate = totalViews>0 ? round(postsWithAi[i].numeric.views/totalViews) : 0;
    }
}
