export function buildError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

export function sendError(res, error) {
    return res.status(error?.status || 500).json({
        error: {
            code: error?.code || "SERVER_ERROR",
            message: error?.message || "Ошибка сервера",
        },
    });
}
