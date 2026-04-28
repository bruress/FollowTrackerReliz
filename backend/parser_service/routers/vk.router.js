import {Router} from "express";
import { auth, parse } from "../controllers/vk.controller.js";
import {addToken, deleteToken, getStatus} from "../controllers/token.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/parse", protect, parse);
router.get("/auth", auth);
router.post("/addToken", protect, addToken);
router.post("/deleteToken", protect, deleteToken);
router.post("/statusToken", protect, getStatus);

export default router;
