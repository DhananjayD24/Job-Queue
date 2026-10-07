import { RedisConnection } from "./redis/RedisConnection.js";
import { Queue } from "./queue/Queue.js";
import { Worker } from "./worker/Worker.js";

const redis = new RedisConnection();

const queue = new Queue("test-queue", redis);

let processed = 0;

const worker = new Worker(
  "test-queue",
  async (job) => {
    console.log(
      `Processing job ${job.id}:`,
      job.name,
      job.data
    );

    processed++;

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  },
  redis
);

await queue.add(
  "send-email",
  {
    to: "test@example.com",
  }
);

await queue.add(
  "send-notification",
  {
    message: "Hello",
  }
);

await new Promise((resolve) =>
  setTimeout(resolve, 3_000)
);

console.log(
  `Jobs processed: ${processed}`
);

await worker.close();
await redis.close();

console.log("E2E test finished.");