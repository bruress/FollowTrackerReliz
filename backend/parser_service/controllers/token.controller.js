import pool from "../models/db.js";
import { buildError, sendError } from "../utils/error.utils.js";
import { encryptToken } from "../utils/token-crypto.utils.js";

const TOKEN_EXPIRES_SAFETY_SEC = 3600;

export const addToken = async (req, res) => {
    try {
        const {user_id, vk_token, expires_in} = req.body || {};
        const token = String(vk_token ?? "").trim();
        const expiresRaw = String(expires_in ?? "" ).trim()
        if (!user_id || !token || !expiresRaw) {
            throw buildError("Пожалуйста заполните все поля", 400, "VALIDATION_ERROR");
        };
        const expiresSec = Number(expiresRaw);
        if (!Number.isSafeInteger(expiresSec) || expiresSec <= 0) {
            throw buildError("expires_in должен быть в секундах и больше нуля", 400, "VALIDATION_ERROR");
        };
        // абсолютное время истечения в секундах
        const nowSec = Math.floor(Date.now()/1000);
        const safeExpiresSec = Math.max(1, Math.floor(expiresSec) - TOKEN_EXPIRES_SAFETY_SEC);
        const expiresAtSec = nowSec + safeExpiresSec;

        await pool.query(
            `INSERT INTO vk_tokens (user_id, vk_token, expires_in) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
            vk_token = EXCLUDED.vk_token,
            expires_in = EXCLUDED.expires_in`,
            [user_id, encryptToken(token), expiresAtSec]
        );

        return res.status(200).json({message: "Токен успешно создан"});
    } catch (error) {
        return sendError(res, error);
    }
};

export const deleteTokenExpiresIn = async () =>  {
    const nowSec = Math.floor(Date.now()/1000);
    await pool.query(
        `DELETE FROM vk_tokens WHERE expires_in <= $1`,
        [nowSec]
    );
};

// таймер
export function startTokenLife() {
    deleteTokenExpiresIn().catch(console.error);    // чтобы сразу почистить всякий мусор при старте сервера
    setInterval(() => {
        deleteTokenExpiresIn().catch(console.error);
    }, 60000);
}

export const deleteToken = async (req, res) => {
    try {
        const user_id = req.body?.user_id;
        if (!user_id) {
            throw buildError("Отсутствует user_id", 400, "VALIDATION_ERROR");
        };
        await pool.query(
            `DELETE FROM vk_tokens WHERE user_id = $1`, [user_id]
        );
        return res.status(200).json({message: "Токен удален"});
    } catch (error) {
        return sendError(res, error);
    }
};

export const getStatus = async (req, res) => {
    try {
        const user_id = req.query?.user_id ?? req.body?.user_id;
        if (!user_id) {
            throw buildError("Отсутствует user_id", 400, "VALIDATION_ERROR");
        };

        const result = await pool.query(
            `SELECT expires_in FROM vk_tokens WHERE user_id = $1`, [user_id]
        );

        if (!result.rows.length) {
            throw buildError("Токен не найден", 404, "TOKEN_NOT_FOUND");
        }

        return res.status(200).json({
            message: "Токен существует",
            expires_in: result.rows[0].expires_in
        });
    } catch (error) {
        return sendError(res, error);
    }
};
