import { Request, Response } from "express";
import { enqueueJob } from "./job.service.js";
import { createJobSchema } from "./job.schema.js";

export async function createJobController(
  req: Request,
  res: Response
) {
  try {
    const parsed = createJobSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid job data",
        errors: parsed.error.issues,
      });

      return;
    }

    const job = await enqueueJob({
      type: parsed.data.type,
      payload: parsed.data.payload,
      priority: parsed.data.priority,
      maxAttempts: parsed.data.maxAttempts,
      runAt: parsed.data.runAt
        ? new Date(parsed.data.runAt)
        : undefined,
    });

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