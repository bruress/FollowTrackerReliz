import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import auth from "./routers/auth.router.js";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, 
}));

app.use(express.json())
app.use(cookieParser());

app.use("/api/auth", auth)

app.listen(PORT, () => {
    console.log(`Request's server listening on port ${PORT}`);
});
