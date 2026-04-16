// express - фреймворк для роутинга и отправки файлов
// dotenv - чтение .env
// axios - запрос с этогоа бек на другой бек
// uuid - рандомная генерация уникального индификатора запроса из 36 символов
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import https from "https"

// чтение .env
dotenv.config();

// порт бека
const PORT = process.env.PORT || 3002;
// для scope
const GIGACHAT_API_PERS = process.env.GIGACHAT_API_PERS || GIGACHAT_API_PERS;
// ключ авторизации
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;

// экземпляр сервера
const app = express();

// понимание формата json, тк он будет приходить от body фронта
app.use(express.json());

// путь сертификата Минцифры
const CA_PATH = process.env.CA_CERT_PATH

// загружаем сертификат Минцифры, тк его нет в списке node.js
const httpsAgent = new https.Agent({
    ca: fs.readFileSync(CA_PATH),
});

// инициализация токена и срока работы, меняются
let accessToken = null;
let tokenExpiresAt = 0;

// функция получения токкена
async function getAccessToken() {
    // если токен существовал и его время не истекло, то возвращаем его, а не создаем новый
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    try {
        // запрос на получение токена по документации
        const response = await axios.post(
            'https://ngw.devices.sberbank.ru:9443/api/v2/oauth', 
            `scope=${GIGACHAT_API_PERS}`,
            {
                httpsAgent, // передаем сертификат в запрос
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'RqUID': uuidv4(),  // гарантия того, что запрос - единственный
                    'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`
                }
            }
        );
        // полученный токен
        accessToken = response.data.access_token;
        // время его действия
        tokenExpiresAt = response.data.expires_at;
        // возвращаем токен
        return accessToken;

    } catch (error) {
        // ошибка от сбера или моего сервера?
        console.error("Ошибка получения токена GigaChat: ", error.response?.data || error.message)
        throw new Error("Не удалось получить токен"); // передает ошибку туда, где вызывается функция, чтобы не начать работу другой функции без токена
    }
};

app.listen(PORT, () => {
    console.log(`GigaChat service listening on port ${PORT}`);
});