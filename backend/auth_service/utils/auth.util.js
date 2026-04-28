// импортируем библиотеки
// jwt - токен юзера
import jwt from "jsonwebtoken";

// настройка куки для браузера
export const cookieOptions = {
    httpOnly: true,                                 // ток http-запросы сервака, никакого фронта >:c
    secure: process.env.NODE_ENV === "development", 
    sameSite: "Strict",                             // "прямая" отправка куки с ЭТОГО сайта, а не стороннего
    maxAge: 30*24*60*60*1000                        // время жизни куки = 30 дней
};

// генератор токена по айди пользователя с помощью jwt
export const generateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: "30d"                           // время жизни токена = 30 дней
    });
};
