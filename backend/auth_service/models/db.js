import {Pool} from "pg";
import dotenv from "dotenv";

dotenv.config();
const pool = new Pool();

pool.on("connect", () => {
    console.log("Connected to the database");
});

pool.on("error", (err) => {
    console.log("Unexprected error on IDLE client: ", err);
    process.exit(-1);
});

export default pool;
