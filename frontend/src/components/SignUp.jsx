import Text from "./Text";
import Logo from "./Logo";
import axios from "axios";
import * as Yup from "yup";
import { useState } from "react";

const SignUp = () => {

    const validationSchema = Yup.object({
        username: Yup.string()
            .required("Укажите фамилию, имя и отчество через пробел")
        .matches(/^[A-Za-zА-ЯЁа-яё]+\s[A-Za-zА-ЯЁа-яё]+\s[A-Za-zА-ЯЁа-яё]+$/, "Укажите фамилию, имя и отчество через пробел"),
        email: Yup.string()
            .required("Укажите адрес электронной почты")
            .email("Проверьте адрес электронной почты")
            .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Проверьте адрес электронной почты"),
        password: Yup.string()
            .required("Укажите пароль")
            .min(6, "Минимально 6 символов")
            .matches(/[a-zA-Zа-яА-ЯёЁ0-9]/, "Недопустимые символы")
    });

    const [form, setForm] = useState({
        username: "",
        email: "",
        password: ""
    });

    const [errors, setError] = useState({});
    const [message, setMessage] = useState("");

    const handleChange = (e) => {
        const {name, value} = e.target;
        setForm({
            ...form,
            [name]: value,
        });
        setMessage("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await validationSchema.validate(form, {abortEarly: false});
            const response = await axios.post("/api/auth/registr", form);
            setMessage("Регистрация прошла успешно");
            setForm({
                username: "",
                email: "",
                password: ""
            });
            setError({})
        } catch(error) {
            if (error.inner) {
                const newErrors = {};
                error.inner.forEach((err) => {
                    newErrors[err.path] = err.message;
                });
                setError(newErrors);
                setMessage("");
            } else if (error.response) {
                const serverError = error.response.data;
                if (serverError.field) {
                    setError({ [serverError.field]: serverError.message });
                } else {
                    setMessage(serverError.message || "Ошибка сервера");
                }
            }
        }
    };

    return (
        <div className="overscroll-contain flex flex-col items-center mx-[20px] sm:mx-[150px] 2xl:mx-[300px] pt-[50px]">
             <Logo/>
            <Text
                text="Регистрация"
                type="title_dr"
                classes="text-center 2xl:px-[200px] pb-[30px] pt-[80px]"
            />
            <form 
                onSubmit={handleSubmit}
                className="w-lg:px-[50px] 2xl:px-[300px] xl:px-[200px] w-full"
            >
        
                <div className="py-[10px]">
                    <Text
                        text="ФИО*"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    <input
                        name="username"
                        type="text"
                        value={form.username}
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="Иванов Иван Иванович"
                        onChange={handleChange}
                    />
                    {errors.username && 
                    <Text 
                        text={errors.username}
                        type="error"
                    />}
                </div>
                <div className="py-[10px]">
                    <Text
                        text="E-mail*"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    <input
                        name="email"
                        type="text"
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="example@mail.ru"
                        value={form.email}
                        onChange={handleChange}
                    />
                    {errors.email && 
                    <Text 
                        text={errors.email}
                        type="error"
                    />}
                </div>
                <div className="py-[10px]">
                    <Text
                        text="Пароль"
                        type="paragraph_dr"
                        classes="pb-[8px]"
                    />
                    <input
                        className="pl-[30px] border-[#58627F] border-[1px] focus:border-[#040C22] focus:border-2 rounded-[25px] outline-none w-full h-[70px] font-inter text-[12px] sm:text-[14px] lg:text-[20px]"
                        placeholder="pass_w0rd"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                    />
                    {errors.password && 
                    <Text 
                        text={errors.password}
                        type="error"
                    />}
                </div>
                <button className="bg-[#17145E] hover:bg-[#110d99] mt-[20px] rounded-[25px] w-full h-[90px] font-raleway font-bold text-[20px] text-white sm:text-[32px] duration-300 hover:cursor-pointer">
                    Зарегистрироваться
                </button>
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