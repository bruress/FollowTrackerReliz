import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool();

pool.on("connect", () => {
    console.log("history_service: подключение к базе данных установлено");
});

pool.on("error", (err) => {
    console.error("history_service: неожиданная ошибка клиента базы данных:", err);
    process.exit(-1);
});

export default pool;
