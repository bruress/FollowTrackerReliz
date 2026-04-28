import bcrypt from "bcrypt";
import pool from "../models/db.js";
import { cookieOptions, generateToken } from "../utils/auth.util.js";
import {buildError, sendError} from "../utils/error.util.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// регистрация
export const registr = async (req, res) => {
    try {
        const {username, email, password} = req.body;
        const safeUsername = String(username || "");
        const safeEmail = String(email || "");
        const safePassword = String(password || "");
    
        if (!safeUsername.trim() || !safeEmail.trim() || !safePassword.trim()) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        };
        // храним email в едином формате, чтобы не было дублей из-за регистра
        const normalizedEmail = safeEmail.toLowerCase();
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            throw buildError("Некорректный email", "VALIDATION_ERROR", 400);
        };
        if (safeUsername.length <2 || safeUsername.length > 64) {
            throw buildError("Имя пользователя должно быть от 2 до 64 символов", "VALIDATION_ERROR", 400);
        };
        if (safePassword.length < MIN_PASSWORD_LENGTH || safePassword.length > 32) {
            throw buildError("Пароль должен быть от 8 до 32 символов", "VALIDATION_ERROR", 400);
        };

        const hashedPassword = await bcrypt.hash(safePassword, 10);
        
        const newUser = await pool.query(
            `INSERT INTO users (username, email, password) 
            VALUES ($1, $2, $3) RETURNING id, username, email`, 
            [safeUsername, normalizedEmail, hashedPassword]
        );

        const token = generateToken(newUser.rows[0].id);
        res.cookie("token", token, cookieOptions);
        return res.status(201).json({ user: newUser.rows[0] });

    } catch (error) {
        // конфликт уникального email на уровне бд
        if (error?.code === "23505") {
            return sendError(res, buildError("Пользователь уже существует", "USER_EXISTS", 409), "Пользователь уже существует", "USER_EXISTS");
        }
        return sendError(res, error, "Ошибка сервера при регистрации");
    };
};

// логин
export const login = async (req, res) => {
    try {
        const {password, email} = req.body;
        const safePassword = String(password || "");
        const safeEmail = String(email || "");
        const normalizedEmail = safeEmail.toLowerCase();
        
        if (!safePassword.trim() || !safeEmail.trim()) {
            throw buildError("Пожалуйста заполните все поля", "VALIDATION_ERROR", 400);
        };
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            throw buildError("Некорректный email", "VALIDATION_ERROR", 400);
        };

        const user = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
        if (user.rows.length === 0) {
            throw buildError("Неверные учетные данные", "AUTH_FAILED", 401);
        };
        const userData = user.rows[0];
        const isMatch = await bcrypt.compare(safePassword, userData.password);
        if (isMatch === false) {
            throw buildError("Неверные учетные данные", "AUTH_FAILED", 401);
        };
        const token = generateToken(userData.id);
        res.cookie("token", token, cookieOptions);

        return res.status(200).json({
            message: "Вход выполнен успешно",
            user: { id: userData.id, username: userData.username, email: userData.email },
        });
    } catch (error) {
        return sendError(res, error, "Ошибка сервера при авторизации");
    }
};

export const me = (req, res) => {
    return res.status(200).json(req.user);
}

// удаляем auth-cookie на выходе
export const logout = (req, res) => {
    res.cookie("token", "", {...cookieOptions, maxAge: 1});
    return res.status(200).json({ message: "Вы успешно вышли из системы" });
}
