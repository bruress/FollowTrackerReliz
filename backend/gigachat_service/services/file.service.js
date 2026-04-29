// [fs] - для работы с файловой системы
// [path] - для сборки путей к входному и выходному файлам на любой ос
// [readJsonFile, writeJsonFile] - импорт для чтения и записи json
import fs from "fs";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

// текущая рабочая папка сервиса
const projectRoot = process.cwd();
// папка с входными файлами из parser_service по пути projectRoot/ ../ parser_service/data
const inputDir = path.join(projectRoot, "..", "parser_service", "data");
// папка для сохранения результатов projectRoot/data
const outputDir = path.join(projectRoot, "data");
const FILE_NAME_PATTERN = /^([a-zA-Z0-9]+)_(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:_year_(0|1)_comments_(0|1))?\.json$/;

// разбираем имя файла и достаем api + domain + даты + флаги
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

    // fallback для старого формата vk_domain_from_to.json
    const parts = safeFileName.slice(0, -5).split("_");
    const apiService = parts[0];
    const secondDate = parts[parts.length - 1];
    const firstDate = parts[parts.length - 2];
    const domain = parts.slice(1, -2).join("_");
    return { apiService, domain, firstDate, secondDate, yearFlag: "0", commentsFlag: "1" };
}

// читаем входной json файл из parser_service/data
export function readInputPosts(fileName) {
    // берем только имя файла
    const saveFileName = path.basename(String(fileName || "").trim());
    // собираем полный путь до входного файла
    const inputPath = path.join(inputDir, saveFileName);
    // читаем и возвращаем json
    return readJsonFile(inputPath);
}

// сохраняем итог анализа в data/output
export function saveAnalysis(fileMeta, result) {
    // создаем папку data, если ее нет
    fs.mkdirSync(outputDir, { recursive: true });
    // собираем имя выходного файла
    const outputFile = `analysis_${fileMeta.apiService}_${fileMeta.domain}_${fileMeta.firstDate}_${fileMeta.secondDate}_year_${fileMeta.yearFlag}_comments_${fileMeta.commentsFlag}.json`;
    // собираем путь до выходного файла
    const outputPath = path.join(outputDir, outputFile);
    // записываем результат в json
    writeJsonFile(outputPath, result);
    return { outputPath, outputFile };
}

// читаем уже сохраненный файл результата
export function readResult(resultFileName) {
    // берем только имя файла
    const safeResultFileName = path.basename(String(resultFileName).trim());
    // собираем путь до результата
    const targetPath = path.join(outputDir, safeResultFileName);
    // читаем и возвращаем json
    return readJsonFile(targetPath);
}
