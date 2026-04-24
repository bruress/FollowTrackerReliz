// [VKAPI] - импорт для запросов к VKAPI
// [saveToJSON] - импорт для сохранения результата в .json
// [WallAnalytic] - импорт для аналитики постов
// [FilterDate] - импорт для фильтра постов по периоду
import VKAPI from '../providers/vk.provider.js';
import saveToJSON from '../providers/file.provider.js';
import WallAnalytic from '../services/analytic.service.js';
import FilterDate from '../filters/date.filter.js';

// редирект ссылка на oauth
const VK_REDIRECT = "https://vkhost.github.io/";   
// шаблон даты
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// максимальная длина периода
const MAX_PERIOD_DAYS = 31;

// парсинг
export const parse = async (req, res) => {
    //const startedAt = Date.now();
    // необходимые поля
    const { vkToken, domainId, from, to, flag} = req.body || {};
    // нормализуем входные значения
    const vkTokenTrim = String(vkToken ?? "").trim();
    const domainIdTrim = String(domainId ?? "").trim();
    const fromStr = String(from ?? "");
    const toStr = String(to ?? "");
    // флаг анализа больше, чем за месяц
    const allowLong = flag === true;
    // если их нет, то просим заполнить
    if (!vkToken || !domainId || !from || !to) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Пожалуйста, заполните все поля", details: null }
        });
    }
    // если ввели пробелы
    if (!vkTokenTrim || !domainIdTrim) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Пожалуйста, заполните все поля корректно", details: null }
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
        if (!allowLong) {
            // ограничиваем диапазон одним месяцем
            const maxPeriodMs = MAX_PERIOD_DAYS*24*60*60*1000;
            const selectedPeriodMs = toDate.getTime()-fromDate.getTime()+1;
            if (selectedPeriodMs > maxPeriodMs) {
                return res.status(400).json({
                    error: { code: "VALIDATION_ERROR", message: "Диапазон дат не должен превышать 1 месяц", details: null }
                });
            }
        };
        
        // инициализаця VK
        const vk = new VKAPI({});
        // устанавливаем пользовательский токен
        vk.setToken(vkTokenTrim);
        // сервис аналитики
        const analytic = new WallAnalytic(vk, new FilterDate());
        // создаем объект периода
        const period = { from: fromDate, to: toDate };
        // получаем данные
        const data = await analytic.getData(domainIdTrim, period) || [];
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
