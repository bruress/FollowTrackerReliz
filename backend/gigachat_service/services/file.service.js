import path from "path";
import { mkdir, readdir } from "fs/promises";
import { readFile, writeFile } from "../utils/json.util.js";

const projectRoot = process.cwd();
const inputDir = path.join(projectRoot, "..", "parser_service", "data");
const outputDir = path.join(projectRoot, "data");
const FILE_NAME_PATTERN = /^([a-zA-Z0-9]+)_(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_month_(0|1)_comments_(0|1)\.json$/;

export function parseFileName(fileName) {
    const safeFileName = path.basename(String(fileName || "").trim());
    const parsedByPattern = safeFileName.match(FILE_NAME_PATTERN);
    if (parsedByPattern) {
        const apiService = parsedByPattern[1];
        const domain = parsedByPattern[2];
        const firstDate = parsedByPattern[3];
        const secondDate = parsedByPattern[4];
        const monthFlag = parsedByPattern[5];
        const commentsFlag = parsedByPattern[6];
        return { apiService, domain, firstDate, secondDate, monthFlag, commentsFlag };
    }
    return null;
}

export async function readPosts(fileName) {
    const saveFileName = path.basename(String(fileName || "").trim());
    const inputPath = path.join(inputDir, saveFileName);
    return readFile(inputPath);
}

export async function saveResult(fileMeta, result) {
    await mkdir(outputDir, { recursive: true });
    const outputFile = `analysis_${fileMeta.apiService}_${fileMeta.domain}_${fileMeta.firstDate}_${fileMeta.secondDate}_month_${fileMeta.monthFlag}_comments_${fileMeta.commentsFlag}.json`;
    const outputPath = path.join(outputDir, outputFile);
    await writeFile(outputPath, result);
    return { outputPath, outputFile };
}

export async function readSavedResult(resultFileName) {
    const safeResultFileName = path.basename(String(resultFileName).trim());
    const targetPath = path.join(outputDir, safeResultFileName);
    return readFile(targetPath);
}

export async function listSavedFiles() {
    await mkdir(outputDir, { recursive: true });
    const files = await readdir(outputDir);
    return files.filter((fileName) => fileName.endsWith(".json"));
}
