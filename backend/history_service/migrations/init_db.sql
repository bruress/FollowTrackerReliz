CREATE TABLE IF NOT EXISTS histories (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    domain TEXT NOT NULL,
    api TEXT NOT NULL,
    to_date DATE NOT NULL,
    from_date DATE NOT NULL,
    flag_comments BOOLEAN NOT NULL DEFAULT FALSE,
    flag_month BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'in_process' CHECK (status IN ('in_process', 'parsing', 'analysing', 'completed', 'failed')),
    parser_file TEXT,
    analysis_file TEXT,
    error TEXT,
    CHECK (from_date <= to_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS histories_unique_key_idx
ON histories (user_id, domain, to_date, from_date, flag_comments, flag_month, api);
