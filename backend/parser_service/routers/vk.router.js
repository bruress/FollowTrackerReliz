import {Router} from "express";
import {auth, parse} from "../controllers/vk.controller.js"

const router = Router();

router.post("/parse", parse);
router.get("/auth", auth);

export default router;