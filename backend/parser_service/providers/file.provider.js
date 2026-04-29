import { mkdir, writeFile } from 'fs/promises';
import path from "path";

async function saveToJSON (file_name, data) {
    const absolutePath = path.resolve("data"); 
    await mkdir(absolutePath, {recursive: true});
    const filePath = path.join(absolutePath, file_name); 
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;

};

export default saveToJSON;