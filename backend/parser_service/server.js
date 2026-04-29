import express from 'express';
import dotenv from "dotenv";
import vkRouter from "./routers/vk.router.js";
import { startTokenLife } from './controllers/token.controller.js';

dotenv.config();

const PORT = process.env.PORT || 3003;

const app = express(); 

app.use(express.json());

// проверка жизни токена каждую минуту
startTokenLife();

app.use("/api/vk", vkRouter);

app.listen(PORT, () => {
    console.log(`parser_service: сервер запущен на порту ${PORT}`);
});
