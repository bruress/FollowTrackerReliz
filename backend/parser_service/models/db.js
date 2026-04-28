// импортируем библиотеки
// Pool - для связи с бд
// dotenv - для чтения .env
import {Pool} from "pg";
import dotenv from "dotenv";

// читаем конфиг
dotenv.config();

// читаем ключи из .env для подключения бд, используя postgresql environment varibles
const pool = new Pool();

// успешно подключились
pool.on("connect", () => {
    console.log("Connected to the database");
});

//ошибка
pool.on("error", (err) => {
    console.log("Unexpected error on IDLE client: ", err);
    process.exit(-1); // прерываем
})

// экспорт для дальнейшего использования
export default pool;
