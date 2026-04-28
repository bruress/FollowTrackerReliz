export function buildError (message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
};

export function sendError (res, error, message) {
    return res.status(error?.status || 500).json({
        error: {
            code: error?.code || "SERVER_ERROR",
            message: error?.message || message
        }
    })
};