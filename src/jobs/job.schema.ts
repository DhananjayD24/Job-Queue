import { z } from "zod";

export const createJobSchema = z.object({
  type: z
    .string()
    .min(1, "Job type is required")
    .max(100, "Job type must be at most 100 characters"),

  payload: z
    .record(z.string(), z.unknown()),

  priority: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(0),

  maxAttempts: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3),

  runAt: z
    .string()
    .datetime()
    .optional(),
});