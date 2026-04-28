import { runAnalysis, getSavedAnalysis } from "../services/analysis.service.js";

function sendError(res, error) {
    return res.status(error?.status || 500).json({
        status: "error",
        message: error?.message || "Внутренняя ошибка",
        code: error?.code || "INTERNAL_ERROR",
    });
}

// запуск анализа файла
export async function analysis(req, res) {
    try {
        // берем fileName из фронта
        const fileName = String(req.body?.fileName || "").trim();

        // если пусто
        if (!fileName) {
            return sendError(res, { status: 400, message: "Имя файла обязательно", code: "FILE_NAME_REQUIRED" });
        }

        // запуск анализа по порядку
        const result = await runAnalysis(fileName);
        // отправляем результаты серверу
        return res.status(200).json({
            status: "success",
            input: fileName,
            outputFile: result.outputFile,
            durationMs: result.durationMs,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// читаем сохраненный результат
export function getAnalysisResultController(req, res) {
    try {
        // берем имя файла 
        const resultFileName = String(req.params?.file || req.query?.file || "").trim();
        // если его нет
        if (!resultFileName) {
            return sendError(res, { status: 400, message: "Имя файла результата обязательно", code: "RESULT_FILE_REQUIRED" });
        }
        // читаем json из data/
        const result = getSavedAnalysis(resultFileName);
        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error);
    }
}
