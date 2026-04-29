CREATE TABLE IF NOT EXISTS vk_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    vk_token TEXT NOT NULL,
    expires_in BIGINT NOT NULL
);
