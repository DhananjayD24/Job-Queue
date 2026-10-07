import type { Redis } from "ioredis";

export class DelayedJobScheduler {
  private readonly client;
  private readonly queueName: string;
  private running = false;

  constructor(
    queueName: string,
    client: Redis
  ) {
    this.queueName = queueName;
    this.client = client;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    void this.processLoop();
  }

  stop(): void {
    this.running = false;
  }

  private async processLoop(): Promise<void> {
    const delayedKey =
      `queue:${this.queueName}:delayed`;

    const readyKey =
      `queue:${this.queueName}:ready`;

    while (this.running) {
      const now = Date.now();

      const jobIds = await this.client.zrangebyscore(
        delayedKey,
        0,
        now,
        "LIMIT",
        0,
        100
      );

      if (jobIds.length === 0) {
        await this.sleep(100);
        continue;
      }

      for (const jobId of jobIds) {
        const removed = await this.client.zrem(
          delayedKey,
          jobId
        );

        if (removed === 1) {
            const priority = Number(
                await this.client.hget(
                  `job:${this.queueName}:${jobId}`,
                  "priority"
                )
              );
              
              await this.client.zadd(
                readyKey,
                -priority,
                jobId
              );

          await this.client.hset(
            `job:${this.queueName}:${jobId}`,
            "status",
            "waiting"
          );
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  }
}