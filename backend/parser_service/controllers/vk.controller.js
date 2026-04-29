import VKAPI from "../providers/vk.provider.js";
import saveToJSON from "../providers/file.provider.js";
import WallAnalytic from "../services/analytic.service.js";
import FilterDate from "../filters/date.filter.js";
import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.utils.js";
import { decryptToken } from "../utils/token-crypto.utils.js";

const VK_REDIRECT = "https://vkhost.github.io/";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parse = async (req, res) => {
    // [УДАЛИТЬ ПОСЛЕ!!!] замер времени парсинга
    const startedAt = Date.now();
    const user_id = req.body?.user_id;
    const { domainId, from, to, flagParsingYear, flagAllowComments } = req.body || {};
    const domainIdTrim = String(domainId ?? "").trim();
    const fromStr = String(from ?? "");
    const toStr = String(to ?? "");
    try {
        if (flagParsingYear !== undefined && typeof flagParsingYear !== "boolean") {
            throw buildError("flagParsingYear должен быть boolean", "VALIDATION_ERROR", 400);
        }
        if (flagAllowComments !== undefined && typeof flagAllowComments !== "boolean") {
            throw buildError("flagAllowComments должен быть boolean", "VALIDATION_ERROR", 400);
        }
        const allowYear = flagParsingYear ?? false;
        const allowComments = flagAllowComments ?? false;
        if (!user_id || !domainIdTrim || !from || !to) {
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
        // если люди не выбирали анализ больше, чем за месяц
        if (!allowYear) {
            // ограничиваем диапазон одним месяцем
            const maxPeriodMs = 31*24*60*60*1000;
            if (selectedPeriodMs > maxPeriodMs) {
                throw buildError("Диапазон дат не должен превышать 1 месяц", "VALIDATION_ERROR", 400);
            }
        }
        // если все же выбрали
        else {
            const maxPeriodMs = 365*24*60*60*1000;
            if (selectedPeriodMs > maxPeriodMs) {
                throw buildError("Максимальный диапазон дат не должен превышать 1 год", "VALIDATION_ERROR", 400);
            }
        }

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

        // сразу убираем просроченный токен
        if (nowSec >= Number(tokenData.expires_in)) {
            await pool.query("DELETE FROM vk_tokens WHERE user_id = $1", [user_id]);
            throw buildError("Срок действия VK токена истек. Введите новый токен", "TOKEN_EXPIRED", 401);
        }
        // получаем данные
        vk.setToken(decryptToken(tokenData.vk_token));
        const analytic = new WallAnalytic(vk, new FilterDate());
        const period = { from: fromDate, to: toDate };
        const data = await analytic.getData(domainIdTrim, period, allowComments);
        const timeFrom = fromDate.toISOString().slice(0, 10);
        const timeTo = toDate.toISOString().slice(0, 10);
        // сохраняем резльутат
        const yearFlag = allowYear ? 1 : 0;
        const commentsFlag = allowComments ? 1 : 0;
        const fileName = `vk_${domainIdTrim}_${timeFrom}_${timeTo}_year_${yearFlag}_comments_${commentsFlag}.json`;
        await saveToJSON(fileName, data);
        // [УДАЛИТЬ ПОСЛЕ!!!] временный блок логов для демо
        const parsingTimeMs = Date.now()-startedAt;
        const postsCount = data.length;
        console.log(`parser_service: posts count = ${postsCount}`);
        console.log("parser_service: parse summary", {
            domainId: domainIdTrim,
            from: timeFrom,
            to: timeTo,
            flagParsingYear: allowYear,
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
