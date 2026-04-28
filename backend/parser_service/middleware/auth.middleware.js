import jwt from "jsonwebtoken";

// защита роутов parser_service по jwt из cookie
export function protect(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "Пользователь не авторизован" }
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.id };
        return next();
    } catch (error) {
        void error;
        return res.status(401).json({
            error: { code: "UNAUTHORIZED", message: "Пользователь не авторизован" }
        });
    }
}

