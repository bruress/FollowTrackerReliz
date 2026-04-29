import "dotenv/config";
import express from "express";
import analysisRouter from "./routers/analysis.router.js";

const PORT = process.env.PORT || 3002;

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use("/api/gigachat", analysisRouter);

app.listen(PORT, () => {
    console.log(`gigachat_service: сервер запущен на порту ${PORT}`);
});
