// собираем объект ошибки с полями для фронта
export function buildError(message, status, code) {
    // создаем объект ошибки с сообщение
    const error = new Error(message);
    // статус ошибки
    error.status = status;
    // код ошибки
    error.code = code;
    // возвращаем ошибку
    return error;
}
