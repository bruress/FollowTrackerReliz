import Cryptr from "cryptr";
import { buildError } from "./error.utils.js";

function getCryptr() {
    const secret = process.env.PARSER_TOKEN_SECRET;
    if (!secret) {
        throw buildError("Отсутствует PARSER_TOKEN_SECRET", 500, "SERVER_ERROR");
    }
    return new Cryptr(secret);
}

export function encryptToken(rawToken) {
    const token = String(rawToken ?? "");
    return getCryptr().encrypt(token);
}

export function decryptToken(storedToken) {
    try {
        const value = String(storedToken ?? "");
        return getCryptr().decrypt(value);
    } catch (error) {
        void error;
        throw buildError("Не удалось расшифровать VK токен", 500, "SERVER_ERROR");
    }
}
