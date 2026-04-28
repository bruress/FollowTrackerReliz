CREATE TABLE IF NOT EXISTS histories (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    domain TEXT NOT NULL,
    to_date DATE NOT NULL,
    from_date DATE NOT NULL,
    flag_comments BOOLEAN NOT NULL DEFAULT TRUE,
    flag_year BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'in_process' CHECK (status IN ('in_process', 'parsing', 'analysing', 'completed', 'failed')),
    parser_file TEXT,
    analysis_file TEXT,
    error TEXT,
    CHECK (from_date <= to_date)
);
-- создаем индекс с именем (уникалным), только если его не существует
CREATE UNIQUE INDEX IF NOT EXISTS histories_unique_key_idx
ON histories (user_id, domain, to_date, from_date, flag_comments, flag_year);
