import { randomUUID } from "node:crypto";
import { RedisConnection } from "../redis/RedisConnection.js";
import type { JobData } from "../jobs/job.types.js";
import { claimJob } from "../redis/scripts/claimJob.js";
import { DelayedJobScheduler } from "../queue/DelayedJobScheduler.js";
import { StalledJobRecovery } from "./StalledJobRecovery.js";

export type Processor = (job: JobData) => Promise<void>;

export interface WorkerOptions {
    concurrency?: number;
    lockDuration?: number;
    heartbeatInterval?: number;
}

export class Worker {
    private readonly name: string;
    private readonly client;
    private readonly processor: Processor;

    private readonly concurrency: number;
    private readonly lockDuration: number;
    private readonly heartbeatInterval: number;
    private readonly workerId: string;

    private running = true;
    private heartbeatTimer?: NodeJS.Timeout;
    private readonly delayedScheduler: DelayedJobScheduler;
    private readonly stalledRecovery: StalledJobRecovery;

    constructor(
        name: string,
        processor: Processor,
        redis: RedisConnection,
        options: WorkerOptions = {}
    ) {
        this.name = name;
        this.processor = processor;

        this.concurrency = options.concurrency ?? 1;
        this.lockDuration = options.lockDuration ?? 30_000;
        this.heartbeatInterval =
            options.heartbeatInterval ?? 10_000;

        this.workerId = randomUUID();
        this.client = redis.getClient();
        this.delayedScheduler =
            new DelayedJobScheduler(
                this.name,
                this.client
            );

        this.delayedScheduler.start();

        this.stalledRecovery =
            new StalledJobRecovery(
                this.name,
                this.workerId,
                this.client
            );

        this.stalledRecovery.start();

        this.start();
    }

    private async start(): Promise<void> {
        this.startHeartbeat();

        const loops = Array.from(
            { length: this.concurrency },
            () => this.processLoop()
        );

        await Promise.all(loops);
    }

    private async processLoop(): Promise<void> {
        while (this.running) {
            const jobId = await claimJob(
                this.client,
                `queue:${this.name}:ready`,
                `queue:${this.name}:processing`,
                `job:${this.name}:`,
                this.workerId,
                Date.now(),
                this.lockDuration
            );

            if (!jobId) {
                await this.sleep(100);
                continue;
            }

            const job = await this.loadJob(jobId);

            if (!job) {
                continue;
            }

            try {
                await this.processor(job);
                await this.completeJob(jobId);
            } catch (error) {
                await this.failJob(jobId, error);
            }
        }
    }

    private async loadJob(
        jobId: string
    ): Promise<JobData | null> {
        const data = await this.client.hgetall(
            `job:${this.name}:${jobId}`
        );

        if (!data.id) {
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            data: JSON.parse(data.data),

            attemptsMade: Number(data.attemptsMade),
            maxAttempts: Number(data.maxAttempts),

            priority: Number(data.priority),

            createdAt: Number(data.createdAt),
            scheduledAt: Number(data.scheduledAt),

            failedReason:
                data.failedReason || undefined,
        };
    }

    private async completeJob(jobId: string): Promise<void> {
        const jobKey = `job:${this.name}:${jobId}`;

        await this.client
            .multi()
            .hset(
                jobKey,
                "status",
                "completed",
                "completedAt",
                String(Date.now())
            )
            .lrem(
                `queue:${this.name}:processing`,
                1,
                jobId
            )
            .exec();
    }

    private async failJob(
        jobId: string,
        error: unknown
    ): Promise<void> {
        const message =
            error instanceof Error
                ? error.message
                : String(error);

        const jobKey = `job:${this.name}:${jobId}`;
        const attemptsMade = Number(
            await this.client.hincrby(
                jobKey,
                "attemptsMade",
                1
            )
        );

        const maxAttempts = Number(
            await this.client.hget(
                jobKey,
                "maxAttempts"
            )
        );

        await this.client.hset(
            jobKey,
            "failedReason",
            message
        );

        await this.client.lrem(
            `queue:${this.name}:processing`,
            1,
            jobId
        );

        if (attemptsMade < maxAttempts) {
            await this.retryJob(
                jobId,
                attemptsMade
            );

            return;
        }

        await this.moveToDeadLetterQueue(
            jobId,
            message
        );
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(
            async () => {
                if (!this.running) {
                    return;
                }

                const jobIds = await this.client.lrange(
                    `queue:${this.name}:processing`,
                    0,
                    -1
                );

                for (const jobId of jobIds) {
                    const jobKey =
                        `job:${this.name}:${jobId}`;

                    const lockedBy =
                        await this.client.hget(
                            jobKey,
                            "lockedBy"
                        );

                    if (lockedBy !== this.workerId) {
                        continue;
                    }

                    await this.client.hset(
                        jobKey,
                        "lockExpiresAt",
                        String(Date.now() + this.lockDuration)
                    );
                }
            },
            this.heartbeatInterval
        );
    }

    async close(): Promise<void> {
        this.running = false;
      
        this.delayedScheduler.stop();
        this.stalledRecovery.stop();
      
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
        }
      }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) =>
            setTimeout(resolve, ms)
        );
    }

    private async retryJob(
        jobId: string,
        attemptsMade: number
    ): Promise<void> {
        const jobKey = `job:${this.name}:${jobId}`;

        const backoffType =
            await this.client.hget(
                jobKey,
                "backoffType"
            );

        const backoffDelay = Number(
            await this.client.hget(
                jobKey,
                "backoffDelay"
            )
        );

        let delay = backoffDelay || 0;

        if (backoffType === "exponential") {
            delay =
                delay *
                Math.pow(2, attemptsMade - 1);
        }

        const scheduledAt =
            Date.now() + delay;

        await this.client.hset(
            jobKey,
            "status",
            "waiting",
            "scheduledAt",
            String(scheduledAt)
        );

        if (delay === 0) {
            await this.client.rpush(
                `queue:${this.name}:ready`,
                jobId
            );

            return;
        }

        await this.client.zadd(
            `queue:${this.name}:delayed`,
            scheduledAt,
            jobId
        );
    }

    private async moveToDeadLetterQueue(
        jobId: string,
        reason: string
    ): Promise<void> {
        const jobKey = `job:${this.name}:${jobId}`;
        const dlqKey = `queue:${this.name}:dlq`;

        await this.client
            .multi()
            .hset(
                jobKey,
                "status",
                "dead-letter",
                "failedReason",
                reason,
                "failedAt",
                String(Date.now())
            )
            .rpush(dlqKey, jobId)
            .exec();
    }
}