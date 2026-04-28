import jwt from 'jsonwebtoken'
import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.util.js";

// проверяем jwt из cookie и подгружаем пользователя в req.user
export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return sendError(res, buildError("Пользователь не авторизован", "UNAUTHORIZED", 401), "Пользователь не авторизован", "UNAUTHORIZED");
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [decoded.id])
        // токен валиден, но пользователя уже нет в бд
        if (user.rows.length === 0 ) {
            return sendError(res, buildError("Пользователь не авторизован", "UNAUTHORIZED", 401), "Пользователь не авторизован", "UNAUTHORIZED");
        }
        req.user = user.rows[0];
        return next();
    } catch (error) {
        return sendError(
            res,
            buildError("Пользователь не авторизован", "UNAUTHORIZED", 401),
            "Пользователь не авторизован",
            "UNAUTHORIZED",
        );
    }
}
