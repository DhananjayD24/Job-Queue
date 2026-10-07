import type { Redis } from "ioredis";
import { recoverStalledJob } from "../redis/scripts/recoverStalledJob.js";

export class StalledJobRecovery {
  private readonly client;
  private readonly queueName: string;
  private readonly interval: number;

  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(
    queueName: string,
    client: Redis,
    interval = 5_000
  ) {
    this.queueName = queueName;
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
      this.timer = undefined;
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

    for (const jobId of jobIds) {
      const jobKey =
        `job:${this.queueName}:${jobId}`;

      await recoverStalledJob(
        this.client,
        jobKey,
        processingKey,
        readyKey,
        jobId
      );
    }
  }
}