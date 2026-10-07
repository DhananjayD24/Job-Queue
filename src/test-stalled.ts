import { RedisConnection } from "./redis/RedisConnection.js";
import { recoverStalledJob } from "./redis/scripts/recoverStalledJob.js";

const redis = new RedisConnection();
const client = redis.getClient();

const queueName = "stalled-test";
const jobId = "1";

const jobKey = `job:${queueName}:${jobId}`;
const processingKey = `queue:${queueName}:processing`;
const readyKey = `queue:${queueName}:ready`;

// Clean previous test data
await client.del(
  jobKey,
  processingKey,
  readyKey
);

// Simulate a job being processed by a worker
await client.hset(
  jobKey,
  "id",
  jobId,
  "name",
  "stalled-job",
  "status",
  "processing",
  "priority",
  "5",
  "lockedBy",
  "worker-crashed",
  "lockedAt",
  String(Date.now() - 10_000),
  "lockExpiresAt",
  String(Date.now() - 5_000)
);

await client.rpush(
  processingKey,
  jobId
);

console.log(
  "Before recovery:"
);

console.log(
    "Processing:",
    await client.lrange(
      processingKey,
      "0",
      "-1"
    )
  );
  
  console.log(
    "Ready:",
    await client.zrange(
      readyKey,
      "0",
      "-1"
    )
  );

// Recover the expired job atomically
const recovered =
  await recoverStalledJob(
    client,
    jobKey,
    processingKey,
    readyKey,
    jobId
  );

console.log(
  "Recovered:",
  recovered
);

console.log(
  "After recovery:"
);

console.log(
  "Processing:",
  await client.lrange(
    processingKey,
    "0",
    "-1"
  )
);

console.log(
  "Ready:",
  await client.zrange(
    readyKey,
    "0",
    "-1"
  )
);

console.log(
  "Job:",
  await client.hgetall(jobKey)
);

await redis.close();