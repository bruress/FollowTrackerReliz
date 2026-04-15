import Text from "./Text";          // компонент текста
import Logo from "./Logo";          // компонент лого
import axios from "axios";          // для запросов к беку
import * as Yup from "yup";         // валидация до запросов к беку
import { useState } from "react";   // для сохранения и изменения состояний

const SignUp = ({setUser}) => {
    //валидация
    const validationSchema = Yup.object({
        username: Yup.string()                                                  // название формы -> данные из формы это строка?
            .required("Укажите имя пользователя")                               // проверка на пустоту
            .min(2, "Слишком короткое имя пользователя")                        // проверяет длину строки с минимум
            .max(50, "Слишком длинное имя пользователя"),                       // проверяет длину строки с максимумом
        email: Yup.string()
            .required("Укажите адрес электронной почты")
            .email("Проверьте адрес электронной почты")
            .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,        // ^ - строго такие символы, $ - проверяет строку до конца, сравнение ввода с шаблоном -> выводит текст ошибки
                    "Проверьте адрес электронной почты"),
        password: Yup.string()
            .required("Укажите пароль")
            .min(6, "Пароль может состоять минимум из 6 символов")                              
            .matches(/^[a-zA-Zа-яА-ЯёЁ0-9]+$/, "Недопустимые символы")
    });

    // деструктуризация массива useState [состояние, функция для изменения]
    // инициализация объекта форм
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: ""
    });
    // инициализация ошибок
    const [errors, setError] = useState({});
    // инициализация сообщений
    const [message, setMessage] = useState("");

    // обработчик формочек
    const handleChange = (e) => {
        const {name, value} = e.target;         // сохраняем из инпута {имя формы, введеные значения}
        setForm({
            ...form,                            // копирование старых данных, чтобы не затирались при написание новых
            [name]: value,                      // обновление поля [name] со значениями [value]
        });
        setMessage("");                         // затирание сообщения при вводе новых данных
        setError({});                           // затираем ошибки при вводе новых данных
    };

    // отправка данных на бек
    const handleSubmit = async (e) => {
        e.preventDefault();                                                 // запрет на перезагрузку страницы при заполнении формочек
        try {
            await validationSchema.validate(form, {abortEarly: false});     // валидация, false: проверка всех полей до конца
            const response = await axios.post("/api/auth/registr", form);   // запрос на бек
            setMessage("Регистрация прошла успешно");                       // без ошибки -> сообщение об успехе
            setForm({                                                       // затиаем данные
                username: "",
                email: "",
                password: ""
            });
            setUser(response.data.user)                                     // запоминаем пользователя и передаем его на другие странички
            setError({})                                                    // затираем ошибки
        } catch(error) {                                                    // ошибка   
            if (error.inner) {                                              // inner - массив ошибок из валидатора Yup
                const newErrors = {};                                       // затираем старые ошибки
                error.inner.forEach((err) => {                              // смотрим ошибки для каждого поля
                    newErrors[err.path] = err.message;                      // [err.path] - поле ошибки, [err.message] - сообщение ошибки
                });
                setError(newErrors);                                        // сохраняем ошибки
                setMessage("");                                             // затираем сообщение
            } else if (error.response) {                                    // если ошибка с бека
                const serverError = error.response.data;                    // сохраняем ошибки
                setMessage(serverError.message || "Ошибка сервера");        // выводим ошибку как сообщение
                }
            }
        }


    return (
        /* контейнер */
        <div className="overscroll-contain flex flex-col items-center mx-[20px] sm:mx-[150px] 2xl:mx-[300px] pt-[50px]">
           {/*  лого по центру */}
             <Logo/>
            {/* текст регистрации */}
            <Text
                text="Регистрация"
                type="title_dr"
                classes="text-center 2xl:px-[200px] pb-[30px] pt-[80px]"
            />
            {/* форма, для отправки данных на бек при нажатие button*/}
            <form 
                onSubmit={handleSubmit}
                className="w-lg:px-[50px] 2xl:px-[300px] xl:px-[200px] w-full"
            >
                {/* контейнер имя пользователя */}
                <div className="py-[10px]">
                    {/* текст, что это форма имя пользователя */}
                    <Text
                        text="Имя пользователя*"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    {/* форма для имя пользователя */}
                    <input
                        name="username"         // название формы
                        type="text"     
                        value={form.username}
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="Иванов Иван Иванович"
                        onChange={handleChange} // реагирует на изменения
                    />
                    {/* ошибки валидатора для имя пользователя */}
                    {errors.username && 
                    <Text 
                        text={errors.username}
                        type="error"
                    />}
                </div>
                {/* контейнер почты */}
                <div className="py-[10px]">
                    {/* текст, что это форма почты */}
                    <Text
                        text="E-mail*"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    {/* форма для почты */}
                    <input
                        name="email"            // название формы
                        type="text"
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="example@mail.ru"
                        value={form.email}
                        onChange={handleChange} // реагирует на изменения
                    />
                    {/* ошибки валидатора для почты */}
                    {errors.email && 
                    <Text 
                        text={errors.email}
                        type="error"
                    />}
                </div>
                <div className="py-[10px]">
                    {/* текст, что это форма пароля */}
                    <Text
                        text="Пароль"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    {/* форма для пароля */}
                    <input
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="pass_w0rd"
                        name="password"                 // название формы
                        type="password"
                        value={form.password}           // значения
                        onChange={handleChange}         // реагирует на изменения
                    />
                    {/* ошибки валидатора для пароля */}
                    {errors.password && 
                    <Text 
                        text={errors.password}
                        type="error"
                    />}
                </div>
                {/* кнопка регистрации */}
                <button className="bg-[#17145E] hover:bg-[#110d99] mt-[20px] rounded-[25px] w-full h-[90px] font-raleway font-bold text-[20px] text-white sm:text-[32px] duration-300 hover:cursor-pointer">
                    Зарегистрироваться
                </button>
                {/* вывод сообщения */}
                {message && 
                <Text 
                    text={message}
                    type="paragraph_dr"
                    classes="text-center pt-[5px]"
                />}
            </form>
        </div>
    );
};

export default SignUp;