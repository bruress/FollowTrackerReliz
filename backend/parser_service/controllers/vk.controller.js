import VKAPI from "../providers/vk.provider.js";
import saveToJSON from "../providers/file.provider.js";
import WallAnalytic from "../services/analytic.service.js";
import FilterDate from "../filters/date.filter.js";
import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.utils.js";
import { decryptToken } from "../utils/token-crypto.utils.js";
import { readFile, readdir } from "fs/promises";
import path from "path";

const VK_REDIRECT = "https://vkhost.github.io/";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PARSER_FILE_PATTERN = /^vk_(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_month_(0|1)_comments_(0|1)\.json$/;

export const parse = async (req, res) => {
    // [УДАЛИТЬ ПОСЛЕ!!!] замер времени парсинга
    const startedAt = Date.now();
    const user_id = req.body?.user_id;
    const { domainId, from, to, flagParsingMonth, flagAllowComments } = req.body || {};
    const domainIdTrim = String(domainId ?? "").trim();
    const fromStr = String(from ?? "");
    const toStr = String(to ?? "");
    try {
        if (flagParsingMonth !== undefined && typeof flagParsingMonth !== "boolean") {
            throw buildError("flagParsingMonth должен быть boolean", "VALIDATION_ERROR", 400);
        }
        if (flagAllowComments !== undefined && typeof flagAllowComments !== "boolean") {
            throw buildError("flagAllowComments должен быть boolean", "VALIDATION_ERROR", 400);
        }
        const allowMonth = flagParsingMonth ?? true;
        const allowComments = flagAllowComments ?? false;
        if (!user_id || !domainIdTrim || !fromStr || !toStr) {
            throw buildError("Пожалуйста, заполните все поля", "VALIDATION_ERROR", 400);
        }
        const fromDate = new Date(fromStr);
        const toDate = new Date(toStr);
        if (!DATE_PATTERN.test(fromStr) || !DATE_PATTERN.test(toStr) || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            throw buildError("Некорректное значение даты", "VALIDATION_ERROR", 400);
        }
        // включаем весь день правой границы
        toDate.setUTCHours(23, 59, 59, 999);
        if (toDate < fromDate) {
            throw buildError("Выберите корректный промежуток времени", "VALIDATION_ERROR", 400);
        }
        const selectedPeriodMs = toDate.getTime()-fromDate.getTime()+1;
        const maxPeriodMs = allowMonth ? 31*24*60*60*1000 : 14*24*60*60*1000;
        if (selectedPeriodMs > maxPeriodMs) {
            throw buildError(allowMonth ? "Диапазон дат не должен превышать 1 месяц" : "Диапазон дат не должен превышать 2 недели", "VALIDATION_ERROR", 400);
        }
        const timeFrom = fromDate.toISOString().slice(0, 10);
        const timeTo = toDate.toISOString().slice(0, 10);
        const monthFlag = allowMonth ? 1 : 0;
        const commentsFlag = allowComments ? 1 : 0;
        const fileName = `vk_${domainIdTrim}_${timeFrom}_${timeTo}_month_${monthFlag}_comments_${commentsFlag}.json`;
        const reused = await collectReusedPosts(domainIdTrim, fromDate, toDate, allowComments);
        let data = reused.posts;

        if (!reused.fullCovered) {
            const vk = new VKAPI({});
            const tokenRow = await pool.query(
                "SELECT vk_token, expires_in FROM vk_tokens WHERE user_id = $1 LIMIT 1",
                [user_id]
            );
            if (tokenRow.rowCount === 0) {
                throw buildError("VK токен не найден. Введите токен", "TOKEN_REQUIRED", 401);
            }
            const tokenData = tokenRow.rows[0];
            const nowSec = Math.floor(Date.now()/1000);
            if (nowSec >= Number(tokenData.expires_in)) {
                await pool.query("DELETE FROM vk_tokens WHERE user_id = $1", [user_id]);
                throw buildError("Срок действия VK токена истек. Введите новый токен", "TOKEN_EXPIRED", 401);
            }
            vk.setToken(decryptToken(tokenData.vk_token));
            const analytic = new WallAnalytic(vk, new FilterDate());
            const mergedByKey = new Map();
            for (const post of data) {
                mergedByKey.set(postKey(post), post);
            }
            for (const range of reused.missingRanges) {
                const period = { from: range.from, to: range.to };
                try {
                    const part = await analytic.getData(domainIdTrim, period, allowComments);
                    for (const post of part) {
                        mergedByKey.set(postKey(post), post);
                    }
                } catch (error) {
                    if (error?.code !== "NO_POSTS_IN_PERIOD") {
                        throw error;
                    }
                }
            }
            data = Array.from(mergedByKey.values());
        }

        if (data.length === 0) {
            throw buildError("В выбранном периоде посты не найдены", "NO_POSTS_IN_PERIOD", 404);
        }
        data.sort((a, b) => {
            if (a.date === b.date) {
                return Number(b.id)-Number(a.id);
            }
            return a.date < b.date ? 1 : -1;
        });
        await saveToJSON(fileName, data);
        // [УДАЛИТЬ ПОСЛЕ!!!] временный блок логов для демо
        const parsingTimeMs = Date.now()-startedAt;
        const postsCount = data.length;
        console.log(`parser_service: posts count = ${postsCount}`);
        console.log("parser_service: parse summary", {
            domainId: domainIdTrim,
            from: timeFrom,
            to: timeTo,
            flagParsingMonth: allowMonth,
            flagAllowComments: allowComments,
            postsCount,
            parsingTimeMs,
            parserFile: fileName
        });
        return res.status(200).json({ result: data });
    } catch (error) {
        return sendError(res, error);
    }
};

export const auth = async (req, res) => {
    res.redirect(VK_REDIRECT);
};

function postKey(post) {
    return `${String(post?.id || "")}__${String(post?.date || "")}`;
}

function parseParserFileName(fileName) {
    const match = String(fileName || "").match(PARSER_FILE_PATTERN);
    if (!match) {
        return null;
    }
    return {
        domain: match[1],
        from: match[2],
        to: match[3],
        commentsFlag: match[5] === "1",
    };
}

function startDay(dateLike) {
    const date = new Date(dateLike);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function endDay(dateLike) {
    const date = new Date(dateLike);
    date.setUTCHours(23, 59, 59, 999);
    return date;
}

function mergeRanges(ranges) {
    if (ranges.length === 0) {
        return [];
    }
    const sorted = [...ranges].sort((a, b) => a.from-b.from);
    const merged = [sorted[0]];
    for (let i=1; i<sorted.length; i+=1) {
        const current = sorted[i];
        const prev = merged[merged.length-1];
        const nextDay = new Date(prev.to);
        nextDay.setUTCDate(nextDay.getUTCDate()+1);
        if (current.from <= nextDay) {
            if (current.to > prev.to) {
                prev.to = current.to;
            }
        } else {
            merged.push(current);
        }
    }
    return merged;
}

function getMissingRanges(requestFrom, requestTo, coveredRanges) {
    const missing = [];
    let cursor = new Date(requestFrom);
    for (const range of coveredRanges) {
        if (range.to < requestFrom || range.from > requestTo) {
            continue;
        }
        const from = range.from < requestFrom ? requestFrom : range.from;
        const to = range.to > requestTo ? requestTo : range.to;
        if (cursor < from) {
            const gapTo = new Date(from);
            gapTo.setUTCDate(gapTo.getUTCDate()-1);
            missing.push({ from: new Date(cursor), to: endDay(gapTo) });
        }
        const next = new Date(to);
        next.setUTCDate(next.getUTCDate()+1);
        next.setUTCHours(0, 0, 0, 0);
        if (next > cursor) {
            cursor = next;
        }
    }
    if (cursor <= requestTo) {
        missing.push({ from: new Date(cursor), to: new Date(requestTo) });
    }
    return missing;
}

async function collectReusedPosts(domain, fromDate, toDate, allowComments) {
    const dataDir = path.resolve("data");
    let files = [];
    try {
        files = await readdir(dataDir);
    } catch {
        files = [];
    }
    const requestFrom = startDay(fromDate);
    const requestTo = endDay(toDate);
    const requestFromStr = requestFrom.toISOString().slice(0, 10);
    const requestToStr = requestTo.toISOString().slice(0, 10);
    const map = new Map();
    const coveredRanges = [];
    for (const fileName of files) {
        const meta = parseParserFileName(fileName);
        if (!meta) {
            continue;
        }
        if (meta.domain !== domain) {
            continue;
        }
        const canUseForCoverage = !allowComments || meta.commentsFlag;
        const sourceFrom = startDay(meta.from);
        const sourceTo = endDay(meta.to);
        if (sourceTo < requestFrom || sourceFrom > requestTo) {
            continue;
        }
        let rows = [];
        try {
            const raw = await readFile(path.join(dataDir, fileName), "utf-8");
            rows = JSON.parse(raw);
        } catch {
            rows = [];
        }
        if (!Array.isArray(rows)) {
            continue;
        }
        for (const post of rows) {
            const date = String(post?.date || "");
            if (date < requestFromStr || date > requestToStr) {
                continue;
            }
            const key = postKey(post);
            if (map.has(key)) {
                if (allowComments && meta.commentsFlag) {
                    map.set(key, post);
                }
                continue;
            }
            const prepared = allowComments ? post : {
                id: post.id,
                date: post.date,
                text: post.text ?? "",
                comments: post.comments ?? 0,
                likes: post.likes ?? 0,
                reposts: post.reposts ?? 0,
                views: post.views ?? 0,
                isAd: Boolean(post.isAd),
            };
            map.set(key, prepared);
        }
        if (canUseForCoverage) {
            const overlapFrom = sourceFrom < requestFrom ? requestFrom : sourceFrom;
            const overlapTo = sourceTo > requestTo ? requestTo : sourceTo;
            coveredRanges.push({ from: new Date(overlapFrom), to: new Date(overlapTo) });
        }
    }
    const mergedRanges = mergeRanges(coveredRanges);
    const missingRanges = getMissingRanges(requestFrom, requestTo, mergedRanges);
    return {
        posts: Array.from(map.values()),
        missingRanges,
        fullCovered: missingRanges.length === 0,
    };
}
