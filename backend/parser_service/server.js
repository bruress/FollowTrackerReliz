// [express] - импорт фреймфорка express
// [dotenv] - импорт для чтения .env
import express from 'express';
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import vkRouter from "./routers/vk.router.js";
import { startTokenLife } from './controllers/token.controller.js';

// читаем .env
dotenv.config();

// порт бека
const PORT = process.env.PORT || 3003;

// экземпляр сервера
const app = express(); 

// понимание формата json, тк он будет приходить от body фронта
app.use(express.json());
app.use(cookieParser());

startTokenLife();

app.use("/api/vk", vkRouter);

app.listen(PORT, () => {
    console.log(`Server listing on port: ${PORT}`);
});
