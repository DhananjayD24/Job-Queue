import { RedisConnection } from "../redis/RedisConnection.js";
import type { JobData, JobOptions } from "../jobs/job.types.js";

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
        const jobId = await this.client.incr(
            `queue:${this.name}:id`
        );

        const now = Date.now();

        const delay = options.delay ?? 0;

        const job: JobData = {
            id: String(jobId),
            name,
            data,

            attemptsMade: 0,
            maxAttempts: options.attempts ?? 3,

            priority: options.priority ?? 0,

            createdAt: now,
            scheduledAt: now + delay,
        };

        await this.client.hset(
            `job:${this.name}:${job.id}`,
            "id",
            job.id,
            "name",
            job.name,
            "data",
            JSON.stringify(job.data),
            "attemptsMade",
            String(job.attemptsMade),
            "maxAttempts",
            String(job.maxAttempts),
            "priority",
            String(job.priority),
            "createdAt",
            String(job.createdAt),
            "scheduledAt",
            String(job.scheduledAt),
            "backoffType",
            options.backoff?.type ?? "fixed",
            "backoffDelay",
            String(options.backoff?.delay ?? 0)
        );

        if (delay > 0) {
            await this.client.zadd(
              `queue:${this.name}:delayed`,
              job.scheduledAt,
              job.id
            );
          } else {
            await this.client.rpush(
              `queue:${this.name}:ready`,
              job.id
            );
          }

        return job;
    }
}