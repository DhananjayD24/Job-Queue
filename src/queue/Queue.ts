import { RedisConnection } from "../redis/RedisConnection.js";
import type { JobData, JobOptions } from "../jobs/job.types.js";
import { addJob } from "../redis/scripts/addJob.js";

export class Queue {
  private readonly name: string;
  private readonly client;

  constructor(
    name: string,
    redis: RedisConnection
  ) {
    this.name = name;
    this.client = redis.getClient();
  }

  async add(
    name: string,
    data: Record<string, unknown>,
    options: JobOptions = {}
  ): Promise<JobData> {
    const now = Date.now();
    const delay = options.delay ?? 0;
    const scheduledAt = now + delay;

    const maxAttempts =
      options.attempts ?? 3;

    const priority =
      options.priority ?? 0;

    const backoffType =
      options.backoff?.type ?? "fixed";

    const backoffDelay =
      options.backoff?.delay ?? 0;

    const jobId = await addJob(
      this.client,
      `queue:${this.name}:id`,
      `queue:${this.name}:ready`,
      `queue:${this.name}:delayed`,
      `job:${this.name}:`,
      name,
      data,
      maxAttempts,
      priority,
      now,
      scheduledAt,
      backoffType,
      backoffDelay
    );

    const job: JobData = {
      id: jobId,
      name,
      data,

      attemptsMade: 0,
      maxAttempts,

      priority,

      createdAt: now,
      scheduledAt,
    };

    return job;
  }
}