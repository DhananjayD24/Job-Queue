import { RedisConnection } from "../redis/RedisConnection.js";
import { Queue } from "../queue/Queue.js";
import { Worker } from "./Worker.js";

const redis = new RedisConnection();

const queue = new Queue("emails", redis);

const worker = new Worker(
  "emails",
  async (job) => {
    console.log("Processing job:", job.id);
    console.log("Job name:", job.name);
    console.log("Job data:", job.data);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Job finished:", job.id);
  },
  redis
);

await queue.add("send-email", {
  to: "user@example.com",
  subject: "Hello from worker",
});

await new Promise((resolve) => setTimeout(resolve, 3000));

await worker.close();
await redis.close();