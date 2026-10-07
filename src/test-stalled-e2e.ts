import {
    Queue,
    Worker,
    RedisConnection,
  } from "./index.js";
  
  const redis = new RedisConnection();
  
  const queue = new Queue(
    "stalled-e2e",
    redis
  );
  
  let workerBProcessed = false;
  
  // Worker B — should eventually recover and process the job
  const workerB = new Worker(
    "stalled-e2e",
    async (job) => {
      console.log(
        `Worker B processed job ${job.id}`
      );
  
      workerBProcessed = true;
    },
    redis,
    {
      lockDuration: 2_000,
      heartbeatInterval: 500,
    }
  );
  
  // Add a job
  await queue.add(
    "crash-test",
    {
      message: "Worker A will crash",
    }
  );
  
  console.log("Job added");
  
  // Worker A — intentionally does NOT complete the job
  const workerA = new Worker(
    "stalled-e2e",
    async (job) => {
      console.log(
        `Worker A claimed job ${job.id}`
      );
  
      // Keep processing so the lock eventually expires
      await new Promise(() => {});
    },
    redis,
    {
      lockDuration: 2_000,
      heartbeatInterval: 500,
    }
  );
  
  // Give Worker A time to claim the job
  await new Promise((resolve) =>
    setTimeout(resolve, 1_000)
  );
  
  console.log(
    "Simulating Worker A crash..."
  );
  
  // Stop Worker A without completing its job.
  // Its lock will eventually expire.
  await workerA.close();
  
  // Wait for Worker B to recover it
  await new Promise((resolve) =>
    setTimeout(resolve, 6_000)
  );
  
  console.log(
    "Worker B processed:",
    workerBProcessed
  );
  
  await workerB.close();
  await redis.close();
  
  console.log(
    "Stalled recovery E2E test finished."
  );