CREATE DATABASE parser_service;
CREATE DATABASE history_service;

\connect auth_service;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    password TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq
ON users (LOWER(email));

\connect parser_service;

CREATE TABLE IF NOT EXISTS vk_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    vk_token TEXT NOT NULL,
    expires_in BIGINT NOT NULL
);

\connect history_service;

CREATE TABLE IF NOT EXISTS histories (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    domain TEXT NOT NULL,
    api TEXT NOT NULL,
    to_date DATE NOT NULL,
    from_date DATE NOT NULL,
    flag_comments BOOLEAN NOT NULL DEFAULT FALSE,
    flag_year BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'in_process' CHECK (status IN ('in_process', 'parsing', 'analysing', 'completed', 'failed')),
    parser_file TEXT,
    analysis_file TEXT,
    error TEXT,
    CHECK (from_date <= to_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS histories_unique_key_idx
ON histories (user_id, domain, to_date, from_date, flag_comments, flag_year, api);
