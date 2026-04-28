// [fs] - для работы с файловой системы
import fs from "fs";

// читаем json файл и парсим
export function readJsonFile(filePath) {
    // строка с содержимым читаемого синхонного файла
    const content = fs.readFileSync(filePath, "utf-8");
    // возвращает JSON строку
    return JSON.parse(content);
}

// пишем объект в json файл с отступами
export function writeJsonFile(filePath, data) {
    // синхрнно записываем строку в файл, с отступами в 2 пробела
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
