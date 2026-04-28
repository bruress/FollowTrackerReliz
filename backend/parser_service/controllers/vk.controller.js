// [VKAPI] - импорт для запросов к VKAPI
// [saveToJSON] - импорт для сохранения результата в .json
// [WallAnalytic] - импорт для аналитики постов
// [FilterDate] - импорт для фильтра постов по периоду
import VKAPI from '../providers/vk.provider.js';
import saveToJSON from '../providers/file.provider.js';
import WallAnalytic from '../services/analytic.service.js';
import FilterDate from '../filters/date.filter.js';
import pool from '../models/db.js';

// редирект ссылка на oauth
const VK_REDIRECT = "https://vkhost.github.io/";   
// шаблон даты
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// парсинг
export const parse = async (req, res) => {
    // необходимые поля
    const {domainId, from, to, flagParsingYear=false, flagAllowComments=true} = req.body || {};
    // нормализуем входные значения
    const domainIdTrim = String(domainId ?? "").trim();
    const fromStr = String(from ?? "");
    const toStr = String(to ?? "");
    // флаг анализа больше, чем за месяц
    const allowYear = flagParsingYear!==false;
    // флаг анализа комментариев
    const allowComments = flagAllowComments !== false;

    const userId = req.user?.id;
    if (!userId) {
        return res.status(400).json({
            error: {code: "UNAUTHORIZED", message: "Отсутствует user_id"}
        });
    }

    // если их нет, то просим заполнить
    if (!domainIdTrim || !from || !to) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Пожалуйста, заполните все поля", details: null }
        });
    }

    // данные некоррекно распарсились
    if (!DATE_PATTERN.test(fromStr) || !DATE_PATTERN.test(toStr)) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Некорректное значение даты", details: null }
        });
    }


    try {
        // преобразование строк в Date
        const fromDate = new Date(fromStr);
        const toDate = new Date(toStr);
        // включаем весь день правой границы
        toDate.setUTCHours(23, 59, 59, 999);
        // даты КОРРЕКТНО распарсились?
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate.toISOString().slice(0, 10) !== fromStr || toDate.toISOString().slice(0, 10) !== toStr) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Некорректное значение даты", details: null }
            });
        }
        // правая граница не раньше левой
        if (toDate < fromDate) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Выберите корректный промежуток времени", details: null }
            });
        }

        // если люди не выбирали анализ больше, чем за месяц
        if (!allowYear) {
            // ограничиваем диапазон одним месяцем
            const maxPeriodMs = 31*24*60*60*1000;
            const selectedPeriodMs = toDate.getTime()-fromDate.getTime()+1;
            if (selectedPeriodMs > maxPeriodMs) {
                return res.status(400).json({
                    error: { code: "VALIDATION_ERROR", message: "Диапазон дат не должен превышать 1 месяц"}
                });
            }
        }
        // если все же выбрали
        else {
            const maxPeriodMs = 365*24*60*60*1000;
            const selectedPeriodMs = toDate.getTime()-fromDate.getTime()+1;
            if (selectedPeriodMs>maxPeriodMs) {
                return res.status(400).json({
                    error: {code: "VALIDATION_ERROR", message: "Максимальный диапазон дат не должен превышать 1 год"}
                });
            }
        }
        
        // инициализаця VK
        const vk = new VKAPI({});
        // читаем токен пользователя из бд
        const tokenRow = await pool.query(
            "SELECT vk_token, expires_in FROM vk_tokens WHERE user_id = $1 LIMIT 1",
            [userId]
        );
        // если токена нет
        if (tokenRow.rows.length === 0) {
            return res.status(401).json({
                error: { code: "TOKEN_REQUIRED", message: "VK токен не найден. Введите токен", details: null }
            });
        }
        // берем первую строку
        const tokenData = tokenRow.rows[0];
        const nowSec = Math.floor(Date.now()/1000);
        // если токен истек, удаляем и просим новый
        if (nowSec >= Number(tokenData.expires_in)) {
            await pool.query("DELETE FROM vk_tokens WHERE user_id = $1", [userId]);
            return res.status(401).json({
                error: { code: "TOKEN_EXPIRED", message: "Срок действия VK токена истек. Введите новый токен", details: null }
            });
        }
        // устанавливаем пользовательский токен
        vk.setToken(tokenData.vk_token);
        // сервис аналитики
        const analytic = new WallAnalytic(vk, new FilterDate());
        // создаем объект периода
        const period = { from: fromDate, to: toDate };
        // получаем данные
        const data = await analytic.getData(domainIdTrim, period, {includeComments: allowComments}) || [];
        // время получения результата
        const timeFrom = fromDate.toISOString().slice(0, 10);
        const timeTo = toDate.toISOString().slice(0, 10);
        // имя файла, в который записываем резльутат
        const file_name = `vk_${domainIdTrim}_${timeFrom}_${timeTo}.json`;
        // сохраняем результат в файл
        await saveToJSON(file_name, data);
        //const parsingMs = Date.now() - startedAt;
        //console.log(`[parse] domain=${domainId} period=${timeFrom}..${timeTo} posts=${data.length} time=${parsingMs}ms`);
        // возвращаем успешный ответ
        res.status(200).json({ result: data });
    } catch (error) {   //ошибка
        // если ошибка ожидаемая/доменная, возвращаем ее как есть
        if (error?.status && error?.code) {
            return res.status(Number(error.status) || 500).json({
                error: {
                    code: String(error.code),
                    message: error.message || "Внутренняя ошибка сервера",
                    details: error.details ?? null
                }
            });
        }
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера", details: null }
        });
    }
};

// редирект для OAuath-авторизации VK
export const auth = async (req, res) => {
    res.redirect(VK_REDIRECT);
};
