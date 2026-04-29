import { Router } from "express";
import { auth, parse } from "../controllers/vk.controller.js";
import { addToken, deleteToken, getStatus } from "../controllers/token.controller.js";

const router = Router();

router.post("/parse", parse);
router.get("/auth", auth);
router.post("/addToken", addToken);
router.post("/deleteToken", deleteToken);
router.post("/statusToken", getStatus);

export default router;
