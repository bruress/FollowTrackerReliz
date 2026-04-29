import Cryptr from "cryptr";
import { buildError } from "./error.utils.js";

function getCryptr() {
    const secret = process.env.PARSER_TOKEN_SECRET;
    if (!secret) {
        throw buildError("Отсутствует PARSER_TOKEN_SECRET", "SERVER_ERROR", 500);
    }
    return new Cryptr(secret);
}

export function encryptToken(rawToken) {
    return getCryptr().encrypt(rawToken);
}

export function decryptToken(storedToken) {
    try {
        return getCryptr().decrypt(storedToken);
    } catch {
        throw buildError("Не удалось расшифровать VK токен", "SERVER_ERROR", 500);
    }
}
