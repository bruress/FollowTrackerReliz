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

// разбираем имя файла api_domain_date_date.json и достаем api + domain + даты
export function parseInputFileName(fileName) {
    // проверка передали ли файл
    const saveFileName = fileName.trim();
    // убираем .json и разбиваем на части
    const parts = saveFileName.slice(0, -5).split("_");
    // берем api сервис из начала имени
    const apiService = parts[0];
    // забираем даты из конца fileName
    const secondDate = parts[parts.length-1];
    const firstDate = parts[parts.length-2];
    // все между api сервисом и датами считаем domain
    const domain = parts.slice(1, -2).join("_");
    
    return { apiService, domain, firstDate, secondDate };
}

// читаем входной json файл из parser_service/data
export function readInputPosts(fileName) {
    // берем только имя файла
    const saveFileName = fileName.trim();
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
    const outputFile = `analysis_${fileMeta.apiService}_${fileMeta.domain}_${fileMeta.firstDate}_${fileMeta.secondDate}.json`;
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
