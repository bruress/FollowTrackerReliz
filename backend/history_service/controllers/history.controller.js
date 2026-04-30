import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.util.js";

export const createHistory = async (req, res) => {
    try {
        const body = req.body || {};
        const userId = body.user_id;
        const api = body.api;
        const domain = body.domain;
        const toDate = body.to_date;
        const fromDate = body.from_date;
        if (!api || !userId || !domain || !toDate || !fromDate) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }
        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw buildError("Некорректное значение даты", "VALIDATION_ERROR", 400);
        }
        if (to < from) {
            throw buildError("Выберите корректный промежуток времени", "VALIDATION_ERROR", 400);
        }
        const periodMs = to.getTime()-from.getTime()+1;
        const maxPeriodMs = 31*24*60*60*1000;
        if (periodMs > maxPeriodMs) {
            throw buildError("Диапазон дат не должен превышать 1 месяц", "VALIDATION_ERROR", 400);
        }

        const flagComments = body.flag_comments === undefined ? false : body.flag_comments;
        const flagMonth = body.flag_month === undefined ? true : body.flag_month;

        const result = await pool.query(`
            INSERT INTO histories (user_id, domain, to_date, from_date, flag_comments, flag_month, api) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, domain, to_date, from_date, flag_comments, flag_month, api)
            DO NOTHING
            RETURNING *;
        `, [userId, domain, toDate, fromDate, flagComments, flagMonth, api]);
    
        if (result.rowCount === 0) {
            const existingHistory = await pool.query(`
                SELECT * FROM histories 
                WHERE user_id = $1 AND domain = $2 AND to_date = $3 AND from_date = $4
                AND flag_comments = $5 AND flag_month = $6 AND api = $7
                LIMIT 1
            `, [userId, domain, toDate, fromDate, flagComments, flagMonth, api]);

            return res.status(200).json({
                message: "Такая история уже существует",
                already_exists: true,
                history: existingHistory.rows[0] ?? null
            });
        }
        return res.status(201).json({
            message: "История успешно создана",
            already_exists: false,
            history: result.rows[0]
        });
    } catch (error) {
        return sendError(res, error);
    }
};

export const getHistoryList = async (req, res) => {
    try {
        const body = req.body || {};
        const userId = body.user_id;
        const page = body.page;
        const limit = body.limit;

        if (!userId || !page || !limit) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        const offset = (page-1)*limit;

        const countResult = await pool.query(`
            SELECT COUNT(*)::int AS total FROM histories WHERE user_id = $1
        `, [userId]);

        const result = await pool.query(`
            SELECT * FROM histories 
            WHERE user_id = $1 
            ORDER BY id DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const total = countResult.rows[0]?.total ?? 0;

        return res.status(200).json({
            message: "История пользователя получена",
            histories: result.rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total/limit)
            }
        });

    } catch (error) {
        return sendError(res, error);
    }
};

export const getOneHistory = async (req, res) => {
    try {
        const body = req.body || {};
        const userId = body.user_id;
        const historyId = req.params?.id;

        if (!userId || !historyId) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        const result = await pool.query(`
            SELECT * FROM histories WHERE id = $1 AND user_id = $2 LIMIT 1
        `, [historyId, userId]);

        if (result.rowCount === 0) {
            throw buildError("История не найдена", "NOT_FOUND", 404);
        }

        const history = result.rows[0];

        return res.status(200).json({
            message: "История успешно получена",
            history
        });

    } catch (error) {
        return sendError(res, error);
    }
};

export const updateStatus = async (req, res) => {
    try {
        const body = req.body || {};
        const userId = body.user_id;
        const historyId = req.params?.id;
        const status = String(body.status || "").trim();

        if (!userId || !historyId || !status) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        if (!["in_process", "parsing", "analysing", "completed", "failed"].includes(status)) {
            throw buildError("Некорректный статус", "VALIDATION_ERROR", 400);
        }

        const historyResult = await pool.query(`
            SELECT * FROM histories WHERE id = $1 AND user_id = $2 LIMIT 1
        `, [historyId, userId]);

        if (historyResult.rowCount === 0) {
            throw buildError("История не найдена", "NOT_FOUND", 404);
        }

        const history = historyResult.rows[0];

        let parserFileName = body.parser_file ?? history.parser_file ?? null;
        let analysisFileName = body.analysis_file ?? history.analysis_file ?? null;
        let errorText = body.error ?? null;

        if (status !== "failed") {
            errorText = null;
        }
        else if (typeof errorText !== "string" || errorText.trim().length === 0) {
            throw buildError("Необходимо поле error", "VALIDATION_ERROR", 400);
        } else {
            errorText = errorText.trim();
        }

        const updateHistory = await pool.query(`
            UPDATE histories SET status = $1, parser_file  = $2, 
            analysis_file = $3, error = $4 WHERE id = $5 AND user_id = $6 
            RETURNING *
        `, [status, parserFileName, analysisFileName, errorText, historyId, userId]);

        return res.status(200).json({
            message: "Статус истории успешно обновлен",
            history: updateHistory.rows[0]
        });
    } catch (error) {
        return sendError(res, error);
    }
};
