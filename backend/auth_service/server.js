// импортируем библиотеки
// express - фреймворк для простой обработки сетевых запросов
// dotenv - для чтения .env
// cookieParser - расшифрока jwt из куки от браузера для авторизации, чтобы понимать, что за пользователь
// cors - связь фронта с беком
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import auth from "./routers/auth.router.js";
import cors from "cors";

// читаем .env
dotenv.config();

// порт бека
const PORT = process.env.PORT || 3001;

// экземпляр сервера
const app = express();

// разрешает отпарвлять запросы с фронта на бек
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // для передачи токенов и куки
}));

app.use(express.json()); // понимание формата json, тк он будет приходить от body фронта
app.use(cookieParser()); // парсер куки

app.use("/api/auth", auth)

// запуск сервера
app.listen(PORT, () => {
    console.log(`Request's server listening on port ${PORT}`);
});