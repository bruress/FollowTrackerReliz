import { Router } from "express";
import { analysis, getResult } from "../controllers/analysis.controller.js";

const router = Router();

router.post("/analysis", analysis);
router.get("/reading/:file", getResult);

export default router;
