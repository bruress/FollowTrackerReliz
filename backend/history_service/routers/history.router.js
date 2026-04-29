import { Router } from "express";
import { getHistoryList, createHistory, getOneHistory, updateStatus } from "../controllers/history.controller.js";

const router = Router();

router.post("/update/:id", updateStatus);
router.post("/list", getHistoryList);
router.post("/one/:id", getOneHistory);
router.post("/add", createHistory);

export default router;
