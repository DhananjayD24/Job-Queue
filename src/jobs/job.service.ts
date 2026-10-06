import { CreateJobInput } from "./job.types.js";
import { createJob } from "./job.repository.js";

export async function enqueueJob(input: CreateJobInput) {
  return createJob(input);
}