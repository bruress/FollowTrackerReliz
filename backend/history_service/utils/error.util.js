export function buildError(message, code, status, details = null) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    error.details = details;
    return error;
}

export function sendError(res, error, fallbackMessage = "Ошибка сервера", fallbackCode = "SERVER_ERROR") {
    return res.status(error?.status || 500).json({
        error: {
            code: error?.code || fallbackCode,
            message: error?.message || fallbackMessage,
            details: error?.details ?? null,
        },
    });
}
