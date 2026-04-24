// [mkdir] - модуль создания директории
// [writeFile] - модуль записи в файл
// [path] - модуль для того, чтобы собирать на любой ОС
import { mkdir, writeFile } from 'fs/promises';
import path from "path";

// сохраняем данные в JSON
async function saveToJSON (file_name, data) {
    // получаем абсолютный путь до папки data/
    const absolutePath = path.resolve("data"); 
    // создае папку, если ее нет
    await mkdir(absolutePath, {recursive: true});
    // получаем полный путь к файлу
    const filePath = path.join(absolutePath, file_name); 
    // записываем и создаем файл
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    // вовзвращаем путь к созданному файлу
    return filePath;

};
// эспортируем функцию для дальнейшего использования
export default saveToJSON;