CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    password TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq
ON users (LOWER(email));
