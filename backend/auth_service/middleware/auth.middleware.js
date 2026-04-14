// импортируем библиотеки
// jwt - токен юзера
// pool - подключение к postgreSQL
import jwt from 'jsonwebtoken'
import pool from "../models/db.js";

// защищающая функция, которая гарантиует, что текущий пользователь - это действительно он, по токену
export const protect = async (req, res, next) => {
    try {
        // запрашиваем токен
        const token = req.cookies.token;
        // если нет, то пользователь не авторизован
        if (!token) {
            return res.status(401).json({message: "Not authoried, token failed"});
        }
        // если токен нашелся, то раскодируем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        // проверяем есть ли такой пользователь в бд
        const user = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [decoded.id])
        // если нет, то пользователь не зарегестрирован
        if (user.rows.length === 0 ) {
            return res.status(401).json({message: "Not authoried, token failed"});
        }
        // получаем пользователя
        req.user = user.rows[0];
        // перенаправление к роутеру дальше с текущим пользователем
        next();
    } catch (error) {
        res.status(401).json({message: "Not authoried, token failed"})
    }
}