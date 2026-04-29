import path from "path";
import { mkdir } from "fs/promises";
import { readJsonFile, writeJsonFile } from "../utils/json.util.js";

const projectRoot = process.cwd();
const inputDir = path.join(projectRoot, "..", "parser_service", "data");
const outputDir = path.join(projectRoot, "data");
const FILE_NAME_PATTERN = /^([a-zA-Z0-9]+)_(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:_year_(0|1)_comments_(0|1))?\.json$/;

export function parseInputFileName(fileName) {
    const safeFileName = path.basename(String(fileName || "").trim());
    const parsedByPattern = safeFileName.match(FILE_NAME_PATTERN);
    if (parsedByPattern) {
        const apiService = parsedByPattern[1];
        const domain = parsedByPattern[2];
        const firstDate = parsedByPattern[3];
        const secondDate = parsedByPattern[4];
        const yearFlag = parsedByPattern[5] ?? "0";
        const commentsFlag = parsedByPattern[6] ?? "1";
        return { apiService, domain, firstDate, secondDate, yearFlag, commentsFlag };
    }
    return null;
}

export async function readInputPosts(fileName) {
    const saveFileName = path.basename(String(fileName || "").trim());
    const inputPath = path.join(inputDir, saveFileName);
    return await readJsonFile(inputPath);
}

export async function saveAnalysis(fileMeta, result) {
    await mkdir(outputDir, { recursive: true });
    const outputFile = `analysis_${fileMeta.apiService}_${fileMeta.domain}_${fileMeta.firstDate}_${fileMeta.secondDate}_year_${fileMeta.yearFlag}_comments_${fileMeta.commentsFlag}.json`;
    const outputPath = path.join(outputDir, outputFile);
    await writeJsonFile(outputPath, result);
    return { outputPath, outputFile };
}

export async function readResult(resultFileName) {
    const safeResultFileName = path.basename(String(resultFileName).trim());
    const targetPath = path.join(outputDir, safeResultFileName);
    return await readJsonFile(targetPath);
}
