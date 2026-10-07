import { RedisConnection } from "../RedisConnection.js";
import { claimJob } from "./claimJob.js";

const redis = new RedisConnection();
const client = redis.getClient();

const readyKey = "queue:test:ready";
const processingKey = "queue:test:processing";
const jobKey = "job:test:1";

await client.del(readyKey, processingKey, jobKey);

await client.rpush(readyKey, "1");

await client.hset(
  jobKey,
  "id",
  "1",
  "name",
  "test-job",
  "status",
  "waiting"
);

const now = Date.now();

const jobId = await claimJob(
  client,
  readyKey,
  processingKey,
  jobKey,
  "worker-1",
  now,
  30000
);

console.log("Claimed job:", jobId);

console.log(
  "Ready:",
  await client.lrange(readyKey, 0, -1)
);

console.log(
  "Processing:",
  await client.lrange(processingKey, 0, -1)
);

console.log(
  "Job:",
  await client.hgetall(jobKey)
);

await redis.close();