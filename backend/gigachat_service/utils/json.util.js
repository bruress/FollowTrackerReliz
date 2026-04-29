import { readFile, writeFile } from "fs/promises";

export async function readJsonFile(filePath) {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
}

export async function writeJsonFile(filePath, data) {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
