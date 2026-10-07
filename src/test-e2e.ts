import { RedisConnection } from "./redis/RedisConnection.js";
import { Queue } from "./queue/Queue.js";
import { Worker } from "./worker/Worker.js";

const redis = new RedisConnection();

const queue = new Queue("reliability-test", redis);

let successfulJobs = 0;
let failedAttempts = 0;

const worker = new Worker(
  "reliability-test",
  async (job) => {
    console.log(
      `Processing ${job.id}: ${job.name}`
    );

    // Retry/DLQ test
    if (job.name === "failing-job") {
      failedAttempts++;

      throw new Error(
        `Intentional failure #${failedAttempts}`
      );
    }

    successfulJobs++;

    await new Promise((resolve) =>
      setTimeout(resolve, 300)
    );
  },
  redis
);

// --------------------------------------------------
// 1. Priority jobs
// --------------------------------------------------

await queue.add(
  "low-priority",
  {
    message: "low"
  },
  {
    priority: 1
  }
);

await queue.add(
  "high-priority",
  {
    message: "high"
  },
  {
    priority: 10
  }
);

// --------------------------------------------------
// 2. Delayed job
// --------------------------------------------------

await queue.add(
  "delayed-job",
  {
    message: "runs later"
  },
  {
    delay: 1_000
  }
);

// --------------------------------------------------
// 3. Retry + exponential backoff + DLQ
// --------------------------------------------------

await queue.add(
  "failing-job",
  {
    message: "this should reach DLQ"
  },
  {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 200
    }
  }
);

// Give the worker enough time to process everything.
await new Promise((resolve) =>
  setTimeout(resolve, 8_000)
);

console.log(
  `Successful jobs: ${successfulJobs}`
);

console.log(
  `Failed attempts: ${failedAttempts}`
);

// --------------------------------------------------
// Shutdown
// --------------------------------------------------

await worker.close();
await redis.close();

console.log("Reliability E2E test finished.");