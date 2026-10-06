import { Router } from "express";
import { createJobController } from "./job.controller.js";

const router = Router();

router.post("/", createJobController);

export default router;