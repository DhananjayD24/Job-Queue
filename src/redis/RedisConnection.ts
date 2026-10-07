import { Redis } from "ioredis";

export class RedisConnection {
  private readonly client: Redis;

  constructor(url = "redis://localhost:6379") {
    this.client = new Redis(url);
  }

  getClient(): Redis {
    return this.client;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}