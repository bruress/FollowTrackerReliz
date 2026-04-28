import { Router } from "express";
import { analysis, getAnalysisResultController } from "../controllers/analysis.controller.js";

const router = Router();

router.post("/analysis", analysis);
router.get("/reading/:file", getAnalysisResultController);

export default router;
