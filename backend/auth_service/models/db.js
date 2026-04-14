// импортируем библиотеки
// Pool - для связи с бд
// dotenv - для чтения .env
import {Pool} from "pg";
import dotenv from "dotenv";

// читаем .env
dotenv.config();

// читаем ключи из .env (PostgreSQL Environment Variables)
const pool = new Pool();

// обработчик события объекта pool об успешном новом соединение с базой
pool.on("connect", () => {
    console.log("Connected to the database");
});

// обработчик события объекта pool об неуспешном установлении нового соединения (e.g. отсутвия интернета во время установления соединения)
pool.on("error", (err) => {
    console.log("Unexprected error on IDLE client: ", err);
    process.exit(-1);
});

// экспортируем для дальнейшего использования в других файлах
export default pool;