import { Request, Response } from "express";
import { enqueueJob } from "./job.service.js";

export async function createJobController(
  req: Request,
  res: Response
) {
  try {
    const job = await enqueueJob(req.body);

    res.status(201).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("Failed to create job:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create job",
    });
  }
}