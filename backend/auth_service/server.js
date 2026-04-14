// импортируем библиотеки
// express - фреймворк для простой обработки сетевых запросов
// dotenv - для чтения .env
// cookieParser - расшифрока jwt из куки от браузера для авторизации, чтобы понимать, что за пользователь
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import auth from "./routers/auth.router.js";

// читаем .env
dotenv.config();

// порт бека
const PORT = process.env.PORT || 3001;

// экземпляр сервера
const app = express();

app.use(express.json()); // понимание формата json, тк он будет приходить от body фронта
app.use(cookieParser()); // парсер куки

app.use("/api/auth", auth)

// запуск сервера
app.listen(PORT, () => {
    console.log(`Request's server listening on port ${PORT}`);
});