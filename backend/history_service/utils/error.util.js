export function buildError (message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}