import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.util.js";

// создание истории
export const createHistory = async (req, res) => {
    try {
        const body = req.body || {};
        const user_id = req.user?.id;
        const {api, domain, to_date, from_date } = body;
        if (!api || !user_id || !domain || !to_date || !from_date) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        // проверка на флаги, чтобы случайно в null/undefined не улететь 
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
            return res.status(200).json({message: "Пользователь уже имеет такую историю"});
        }
        return res.status(201).json({
            message: "История успешно создана",
            history: result.rows[0]
        });
       
    } catch (error) {
        return sendError(res, error, "Ошибка сервера при создании истории")
    }
};

// получение всей истории пользователя
export const getHistoryList = async (req, res) => {
    try {
        const user_id = req.user?.id;

        if (!user_id) {
            throw buildError("Отсутствует user_id", "VALIDATION_ERROR", 400);
        }
        // от новых к старому
        const result = await pool.query(`
            SELECT * FROM histories WHERE user_id = $1 ORDER BY id DESC
        `, [user_id]);

        return res.status(200).json({
            message: "История пользователя получена",
            histories: result.rows
        });

    } catch (error) {
        return sendError(res, error, "Ошибка сервера при получении истории пользователя")
    }
};

// получение одной истории
export const getOneHistory = async (req, res) => {
    try {   
        const user_id = req.user?.id;
        const history_id = req.params?.id;  // подставляется из url
        
        if (!user_id || !history_id) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        };

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
        return sendError(res, error, "Ошибка сервера при получении одной истории")
    };
};

// обновляет статусы
export const updateStatus = async (req, res) => {
    try {
        const user_id = req.user?.id;
        const history_id = req.params?.id;  // подставляется из url
        const body = req.body || {};
        const status = String(body.status || "").trim();

        if (!status || !user_id || !history_id) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        };
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

        let parser_file_name = body.parser_file ?? history.parser_file;
        let analysis_file_name = body.analysis_file ?? history.analysis_file;
        let errorText = body.error ?? null;


        if (status === "parsing" && !parser_file_name) {
            parser_file_name = `${history.api}_${history.domain}_${history.from_date}_${history.to_date}.json`;
        }
    
        if (status === "analysing"  && !analysis_file_name) {
            analysis_file_name = `analysis_${history.api}_${history.domain}_${history.from_date}_${history.to_date}.json`;
        }

        if (status === "completed") {
            if (!parser_file_name) {
                parser_file_name = `${history.api}_${history.domain}_${history.from_date}_${history.to_date}.json`;
            }
            if (!analysis_file_name) {
                analysis_file_name = `analysis_${history.api}_${history.domain}_${history.from_date}_${history.to_date}.json`;
            }
        }

        if (status !== "failed") {
            errorText = null;
        }
        else if (!errorText) {
            throw buildError("Необходимо поле error", "VALIDATION_ERROR", 400);
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
        return sendError(res, error, "Ошибка сервера при обновлении статуса")
    };
};
