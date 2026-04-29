import jwt from "jsonwebtoken";

export const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",
    sameSite: "Strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};
