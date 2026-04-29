import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.util.js";

export const createHistory = async (req, res) => {
    try {
        const body = req.body || {};
        const user_id = body.user_id;
        const {api, domain, to_date, from_date } = body;
        if (!api || !user_id || !domain || !to_date || !from_date) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        const flag_comments = body.flag_comments === undefined ? false : body.flag_comments;
        const flag_year = body.flag_year === undefined  ? false : body.flag_year;
        
        const result = await pool.query (`
            INSERT INTO histories (user_id, domain, to_date, from_date, flag_comments, flag_year, api) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, domain, to_date, from_date, flag_comments, flag_year, api)
            DO NOTHING
            RETURNING *;
        `, [user_id, domain, to_date, from_date, flag_comments, flag_year, api]);
    
        if (result.rowCount == 0) {
            const existingHistory = await pool.query(`
                SELECT * FROM histories 
                WHERE user_id = $1 AND domain = $2 AND to_date = $3 AND from_date = $4
                AND flag_comments = $5 AND flag_year = $6 AND api = $7
                LIMIT 1
            `, [user_id, domain, to_date, from_date, flag_comments, flag_year, api]);

            return res.status(200).json({
                message: "Такая история уже существует",
                already_exists: true,
                history: existingHistory.rows[0] || null
            });
        }
        return res.status(201).json({
            message: "История успешно создана",
            already_exists: false,
            history: result.rows[0]
        });
       
    } catch (error) {
        return sendError(res, error, "Ошибка сервера при создании истории", "CREATE_HISTORY_ERROR")
    }
};

export const getHistoryList = async (req, res) => {
    try {
        const body = req.body || {};
        const user_id = body.user_id;
        const page = body.page;
        const limit = body.limit;

        if (!user_id || !page || !limit) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        const offset = (page - 1) * limit;

        const countResult = await pool.query(`
            SELECT COUNT(*)::int AS total FROM histories WHERE user_id = $1
        `, [user_id]);

        const result = await pool.query(`
            SELECT * FROM histories 
            WHERE user_id = $1 
            ORDER BY id DESC
            LIMIT $2 OFFSET $3
        `, [user_id, limit, offset]);

        const total = countResult.rows[0]?.total ?? 0;

        return res.status(200).json({
            message: "История пользователя получена",
            histories: result.rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        return sendError(res, error, "Ошибка сервера при получении истории пользователя", "GET_HISTORY_LIST_ERROR")
    }
};

export const getOneHistory = async (req, res) => {
    try {   
        const user_id = req.body?.user_id;
        const history_id = req.params?.id;

        if (!user_id || !history_id) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        const result = await pool.query(`
            SELECT * FROM histories WHERE id = $1 AND user_id = $2 LIMIT 1
        `, [history_id, user_id]);

        if (result.rowCount === 0) {
            throw buildError("История не найдена", "NOT_FOUND", 404);
        };

        const history = result.rows[0];
        
        return res.status(200).json({
            message: "История успешно получена",
            history
        });

    } catch (error) {
        return sendError(res, error, "Ошибка сервера при получении одной истории", "GET_ONE_HISTORY_ERROR")
    };
};

export const updateStatus = async (req, res) => {
    try {
        const body = req.body || {};
        const user_id = body.user_id;
        const history_id = req.params?.id; 
        const status = String(body.status || "").trim();

        if (!user_id || !history_id || !status) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }
        
        if (status !== "in_process" && status !== "parsing" && status !== "analysing" && status !== "completed" &&  status !== "failed") {
            throw buildError("Некорректный статус", "VALIDATION_ERROR", 400);
        }

        const historyResult = await pool.query(`
            SELECT * FROM histories WHERE id = $1 AND user_id = $2 LIMIT 1
        `, [history_id, user_id]);

        if (historyResult.rowCount === 0) {
            throw buildError("История не найдена", "NOT_FOUND", 404);
        };

        const history = historyResult.rows[0];

        let parser_file_name = body.parser_file ?? history.parser_file ?? null;
        let analysis_file_name = body.analysis_file ?? history.analysis_file ?? null;
        let errorText = body.error ?? null;

        if (body.parser_file !== undefined && body.parser_file !== null && typeof body.parser_file !== "string") {
            throw buildError("parser_file должен быть строкой", "VALIDATION_ERROR", 400);
        }
        if (body.analysis_file !== undefined && body.analysis_file !== null && typeof body.analysis_file !== "string") {
            throw buildError("analysis_file должен быть строкой", "VALIDATION_ERROR", 400);
        }

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
        `, [status, parser_file_name, analysis_file_name, errorText, history_id, user_id]);

        return res.status(200).json({
            message: "Статус истории успешно обновлен",
            history: updateHistory.rows[0]
        });
    } catch (error) {
        return sendError(res, error, "Ошибка сервера при обновлении статуса", "UPDATE_HISTORY_STATUS_ERROR")
    };
};
