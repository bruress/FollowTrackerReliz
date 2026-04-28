// [dotenv/config] - загрузка .env до остальных импортов
// [express] - фреймворк для http-запросов
import "dotenv/config";
import express from "express";
import analysisRouter from "./routers/analysis.router.js";

// порт бека
const PORT = process.env.PORT || 3002;

// экземпляр сервера
const app = express();

// включаем парсинг json до 10мб
app.use(express.json({ limit: "10mb" }));

app.use("/api/gigachat", analysisRouter);

// запускаем сервер
app.listen(PORT, () => {
    console.log(`Server listing on port: ${PORT}`);
});
