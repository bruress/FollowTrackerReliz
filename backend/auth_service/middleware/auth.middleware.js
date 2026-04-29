import jwt from "jsonwebtoken";
import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.util.js";

// проверяем jwt из cookie и подгружаем пользователя в req.user
export const protect = async (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            throw buildError("Пользователь не авторизован", "UNAUTHORIZED", 401);
        }
        if (!process.env.JWT_SECRET) {
            throw buildError("Ошибка конфигурации сервера", "CONFIG_ERROR", 500);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [decoded.id]);

        if (user.rowCount === 0) {
            throw buildError("Пользователь не авторизован", "UNAUTHORIZED", 401);
        }
        req.user = user.rows[0];
        return next();
    } catch (error) {
        if (error?.name === "TokenExpiredError" || error?.name === "JsonWebTokenError") {
            return sendError(res, buildError("Пользователь не авторизован", "UNAUTHORIZED", 401));
        }
        return sendError(res, error, "Ошибка сервера при проверке авторизации");
    }
};
