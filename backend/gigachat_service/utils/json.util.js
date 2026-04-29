import { readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";

export async function readFile(filePath) {
    const content = await fsReadFile(filePath, "utf-8");
    return JSON.parse(content);
}

export async function writeFile(filePath, data) {
    await fsWriteFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
