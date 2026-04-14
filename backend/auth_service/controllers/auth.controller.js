// импортируем библиотеки
// bcrypt - создание хэша для пароля
// pool - подключение к postgreSQL

import bcrypt from "bcrypt";
import pool from "../models/db.js";
import { cookieOptions, generateToken } from "../utils/auth.util.js";

// http запрос на создание, позволяющий многим одновременно отправлять запрос на сервер (async)
// req - запрашиваем все, что получили от юзера (из req.body) 
// res - мы вернем что-нибудь
export const registr = async (req, res) => {
    // получаем с фронта данные
    const {username, email, password} = req.body;
    // если что-то пустое, то просим заполнить все
    if (!username || !email || !password) {
        return res.status(400).json({message: "Please provide all required fields"});
    };
    // пользователь существует? (определяем по уникальному email)
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    // если он есть -> то уведомляем, что пользователь уже существует и дальнейшая регистрация бессмыслена, т.к. юзер уже есть
    if (userExists.rows.length > 0) {
        return res.status(400).json({message: "User already exists"});
    }
    // хэшируем пароль 10 солями
    const hashedPassword = await bcrypt.hash(password, 10);
    // удалить потом * и заменить на id, name, email
    // создаем нового пользователя
    const newUser = await pool.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *", [username, email, hashedPassword]);
    // генерируем jwt по айдишнику созданного пользователя
    const token = generateToken(newUser.rows[0].id);
    // отпарвляем токен браузеру (Set-Cookie) с текущими настройками и токеном и он возвращает его на протяжении 30 дней
    res.cookie("token", token, cookieOptions);
    // возвращаем созданного пользователя (он один)
    return res.status(201).json({user: newUser.rows[0]});
};

// http запрос на создание, позволяющий многим одновременно отправлять запрос на сервер (async)
// req - запрашиваем все, что получили от юзера (из req.body) 
// res - мы вернем что-нибудь
export const login = async (req, res) => {
    // получаем с фронта данные
    const {password, email} = req.body;
    // если чего-то не ввели, то ошибка
    if (!password || !email) {
        return res.status(400).json({message: "Please provide all required fields"});
    };
    // получаем пользователя
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    // такого пользователя не существуют
    if (user.rows.length === 0) {
        return res.status(400).json({message: "User doesn't exists or invalid credentials"});
    };
    // иначе сохраняем всю информацию о нем
    const userData = user.rows[0];
    // сравниваем хэш и введеный пароль
    const isMatch = await bcrypt.compare(password, userData.password);
    // если не совпадают -> пароль неправильный
    if (isMatch === false) {
        return res.status(400).json({message: "Invalid password"});
    };
    // создаем опять токен
    const token = generateToken(userData.id);
    // сохраняем его в браузере
    res.cookie("token", token, cookieOptions)

    res.status(200).json({message: "Success",
        user:{ id: userData.id, username: userData.username, email: userData.email}
    })

};

// http запрос на получение с удостоверением по токену (protect)
// req - запрашиваем все, что получили от юзера (из req.body) 
// res - возвращаем пользователя
export const me = (req, res) => {
    res.json(req.user)
}

// http запрос на создание, позволяющий многим одновременно отправлять запрос на сервер (async)
// req - запрашиваем все, что получили от юзера (из req.body) 
// res - мы вернем что-нибудь
export const logout = (req, res) => {
    res.cookie("token", "", {...cookieOptions, maxAge: 1});    // затираем старый куки в текущие настройки, без вложения, и устанавливаем скрок жизни в 1мс
    res.json({message: "Logged out succesfully"})
}
