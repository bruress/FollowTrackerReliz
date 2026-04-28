import pool from "../models/db.js";
import { buildError } from "../utils/error.util.js";

// создание истории
export const create_history = async (req, res) => {
    try {
        const body = req.body || {};
        const user_id = req.user?.id;
        const {domain, to_date, from_date } = body;
        if (!user_id || !domain || !to_date || !from_date) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        }

        // проверка на флаги, чтобы случайно в null/undefined не улететь 
        const flag_comments = body.flag_comments === undefined ? true : body.flag_comments;
        const flag_year = body.flag_year === undefined  ? false : body.flag_year;
        
        const result = await pool.query (`
            INSERT INTO histories (user_id, domain, to_date, from_date, flag_comments, flag_year) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, domain, to_date, from_date, flag_comments, flag_year)
            DO NOTHING
        `, [user_id, domain, to_date, from_date, flag_comments, flag_year])
    
        if (result.rowCount == 0) {
            return res.status(200).json({message: "Пользователь уже имеет такую историю"});
        }
        return res.status(201).json({message: "История успешно создана"});
       
    } catch (error) {
        return res.status(error?.status || 500).json({
            error: {
                code: error?.code || "SERVER_ERROR", 
                message: error?.message || "Ошибка сервера при создании истории"
            }
        });
    }
};