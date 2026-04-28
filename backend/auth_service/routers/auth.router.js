import { Router } from "express";
import {registr, login, me, logout} from "../controllers/auth.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/registr", registr);
router.post("/login", login)
router.post("/logout", logout);
router.get("/me", protect, me)

export default router;
