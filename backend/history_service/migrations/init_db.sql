CREATE TABLE IF NOT EXISTS histories (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    domain TEXT NOT NULL,
    to_date DATE NOT NULL,
    from_date DATE NOT NULL,
    flag_comments BOOLEAN NOT NULL DEFAULT TRUE,
    flag_year BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL CHECK (status IN ('in_process', 'parsing', 'analysing', 'completed', 'failed')),
    parser_file TEXT,
    analysis_file TEXT,
    error TEXT,
    CHECK (from_date <= to_date)
);
