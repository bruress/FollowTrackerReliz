import pool from "../models/db.js";
import { buildError } from "../utils/error.utils.js";

// добавление токена в бд
export const addToken = async (req, res) => {
    try {
        const user_id = req.user?.id;
        const {vk_token, expires_in} = req.body;
        if (!user_id || !vk_token || !expires_in) {
            throw buildError("Пожалуйста заполните все поля", 400, "TOKEN_ERROR");
        };
        // срок жизни токена в секундах
        const expiresInSec = Number(expires_in);
        if (!Number.isFinite(expiresInSec) || expiresInSec<=0) {
            throw buildError("expires_in должен быть в секундах и больше нуля", 400, "TOKEN_ERROR");
        }
        // текущий unix в секундах
        const nowSec = Math.floor(Date.now()/1000);
        // абсолютное время истечения в секундах
        const expiresAtSec = nowSec+Math.floor(expiresInSec);

        await pool.query(
            `INSERT INTO vk_tokens (user_id, vk_token, expires_in) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
            vk_token = EXCLUDED.vk_token,
            expires_in = EXCLUDED.expires_in`,
            [user_id, vk_token, expiresAtSec]
        );

        return res.status(200).json({message: "Токен успешно создан"});
    } catch (error) {
        return res.status(error?.status || 500).json({
            error: {
                code: error?.code || "SERVER_ERROR",
                message: error?.message || "Ошибка сервера при вводе токена"
            }
        });
    }
};

// удаление токена по истечению
export const deleteTokenExpiresIn = async () =>  {
    // текущий unix в секундах
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
    }, 60000); // раз в минуту
}

// удаление токена пользователем
export const deleteToken = async (req, res) => {
    try {
        const user_id = req.user?.id;
        if (!user_id) {
            throw buildError("Отсутствует user_id", 400, "TOKEN_ERROR");
        };

        await pool.query(
            `DELETE FROM vk_tokens WHERE user_id = $1`, [user_id]
        );

        return res.status(200).json({message: "Токен удален"});
    } catch (error) {
        return res.status(error?.status || 500).json({
            error: {
                code: error?.code || "SERVER_ERROR",
                message: error?.message || "Ошибка сервера при удалении токена"
            }
        });
    }
};

export const getStatus = async (req, res) => {
    try {
        const user_id = req.user?.id;
        if (!user_id) {
            throw buildError("Отсутствует user_id", 400, "TOKEN_ERROR");
        };

        const result = await pool.query(
            `SELECT expires_in FROM vk_tokens WHERE user_id = $1`, [user_id]
        );

        if (!result.rows.length) {
            return res.status(404).json({message: "Токен не найден"});
        }

        return res.status(200).json({
            message: "Токен существует",
            expires_in: result.rows[0].expires_in
        });
    } catch (error) {
        return res.status(error?.status || 500).json({
            error: {
                code: error?.code || "SERVER_ERROR",
                message: error?.message || "Ошибка сервера при проверке токена"
            }
        });
    }
};
