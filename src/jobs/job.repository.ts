import pool from "../db/pool.js";
import { CreateJobInput, Job } from "./job.types.js";
import { randomUUID } from "crypto";

export async function createJob(
  input: CreateJobInput
): Promise<Job> {
  const id = randomUUID();

  const query = `
    INSERT INTO jobs (
      id,
      type,
      payload,
      priority,
      max_attempts,
      run_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    id,
    input.type,
    input.payload,
    input.priority ?? 0,
    input.maxAttempts ?? 3,
    input.runAt ?? new Date(),
  ];

  const result = await pool.query<Job>(query, values);

  return result.rows[0];
}