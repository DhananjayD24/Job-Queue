import type { Redis } from "ioredis";

export class StalledJobRecovery {
  private readonly client;
  private readonly queueName: string;
  private readonly workerId: string;
  private readonly interval: number;

  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(
    queueName: string,
    workerId: string,
    client: Redis,
    interval = 5_000
  ) {
    this.queueName = queueName;
    this.workerId = workerId;
    this.client = client;
    this.interval = interval;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    void this.check();

    this.timer = setInterval(
      () => {
        void this.check();
      },
      this.interval
    );
  }

  stop(): void {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async check(): Promise<void> {
    if (!this.running) {
      return;
    }

    const processingKey =
      `queue:${this.queueName}:processing`;

    const readyKey =
      `queue:${this.queueName}:ready`;

    const jobIds = await this.client.lrange(
      processingKey,
      0,
      -1
    );

    const now = Date.now();

    for (const jobId of jobIds) {
      const jobKey =
        `job:${this.queueName}:${jobId}`;

      const lockExpiresAt =
        Number(
          await this.client.hget(
            jobKey,
            "lockExpiresAt"
          )
        );

      if (
        !lockExpiresAt ||
        lockExpiresAt > now
      ) {
        continue;
      }

      const removed =
        await this.client.lrem(
          processingKey,
          1,
          jobId
        );

      if (removed !== 1) {
        continue;
      }

      await this.client
        .multi()
        .hset(
          jobKey,
          "status",
          "waiting"
        )
        .hdel(
          jobKey,
          "lockedBy",
          "lockedAt",
          "lockExpiresAt"
        )
        .rpush(
          readyKey,
          jobId
        )
        .exec();
    }
  }
}