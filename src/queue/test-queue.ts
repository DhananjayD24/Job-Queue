import { RedisConnection } from "../redis/RedisConnection.js";
import { Queue } from "./Queue.js";

const redis = new RedisConnection();

const queue = new Queue("emails", redis);

const job = await queue.add("send-email", {
  to: "user@example.com",
  subject: "Welcome!"
});

console.log("Created job:");
console.log(job);

await redis.close();