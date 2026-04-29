import { runAnalysis, getSavedAnalysis } from "../services/analysis.service.js";
import { buildError, sendError } from "../utils/error.util.js";

export async function analysis(req, res) {
    try {
        const fileName = String(req.body?.fileName || "").trim();
        if (!fileName) {
            throw buildError("Имя файла обязательно", "VALIDATION_ERROR", 400);
        }
        const result = await runAnalysis(fileName);
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

export async function getResult(req, res) {
    try {
        const resultFileName = String(req.params?.file || "").trim();
        if (!resultFileName) {
            throw buildError("Имя файла результата обязательно", "VALIDATION_ERROR", 400);
        }
        const result = await getSavedAnalysis(resultFileName);
        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error);
    }
}
