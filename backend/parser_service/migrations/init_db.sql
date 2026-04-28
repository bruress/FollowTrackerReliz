-- создаем таблицу токенов для того, чтоб лишний раз не заставлять пользователей вводить токен
-- id - уникальный индификатор
-- user_id - связь с бд микросерсива регистрации
-- token - вк токен, обязателен к заполнению и быть уникальным
-- expires_in - время исчезновения токена из бд в unix-секундах
CREATE TABLE IF NOT EXISTS vk_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    vk_token TEXT NOT NULL,
    expires_in BIGINT NOT NULL
);
