# Reliable Job Queue

A Redis-backed reliable job queue for Node.js and TypeScript with priority scheduling, delayed jobs, retries with backoff, dead-letter queues, concurrency, visibility timeouts, heartbeats, and stalled-job recovery.

Built as a reusable npm library for applications that need reliable background job processing without implementing queue infrastructure from scratch.

## Features

- 🚀 Redis-backed job queue
- ⚡ Priority-based scheduling
- ⏱️ Delayed jobs
- 🔁 Automatic retries
- 📈 Fixed and exponential backoff
- 💀 Dead-letter queue (DLQ)
- 🛡️ Visibility timeout / job locking
- ❤️ Worker heartbeats
- 🔄 Stalled-job recovery
- 👷 Configurable worker concurrency
- 🧹 Graceful worker shutdown
- 🔐 Atomic Redis operations using Lua scripts
- 📦 TypeScript declarations included
- 🌐 Custom Redis connection URL
- 📚 Designed as a reusable npm package
- 📄 ESM support

## Installation

```bash
npm install reliable-job-queue
```

You also need a running Redis server.

## Quick Start

```ts
import {
  Queue,
  Worker,
  RedisConnection,
} from "reliable-job-queue";

const redis = new RedisConnection(
  "redis://localhost:6379"
);

const queue = new Queue(
  "emails",
  redis
);

const worker = new Worker(
  "emails",
  async (job) => {
    console.log("Processing job:", job.id);
    console.log("Job name:", job.name);
    console.log("Job data:", job.data);

    // Your application logic
    await sendEmail(job.data);
  },
  redis
);

await queue.add(
  "send-email",
  {
    to: "user@example.com",
    subject: "Welcome"
  }
);
```

The application provides the actual business logic through the processor function.

The library handles the queue infrastructure:

- job scheduling
- job claiming
- Redis coordination
- locking
- heartbeats
- retries
- backoff
- delayed jobs
- dead-letter handling
- stalled-job recovery
- worker concurrency

---

# Redis Configuration

The library accepts a Redis connection URL.

## Local Redis

```ts
const redis = new RedisConnection(
  "redis://localhost:6379"
);
```

## Environment Variable

```ts
const redis = new RedisConnection(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);
```

Example:

```text
REDIS_URL=redis://localhost:6379
```

A hosted Redis instance can also be used:

```ts
const redis = new RedisConnection(
  "redis://username:password@host:6379"
);
```

The application is responsible for providing the Redis connection configuration.

---

# Queue

Create a queue by giving it a name and Redis connection:

```ts
const queue = new Queue(
  "emails",
  redis
);
```

The queue name identifies the logical queue.

For example:

```ts
const emailQueue = new Queue(
  "emails",
  redis
);

const notificationQueue = new Queue(
  "notifications",
  redis
);
```

---

# Adding Jobs

Add a job using:

```ts
await queue.add(
  "send-email",
  {
    to: "user@example.com"
  }
);
```

The method accepts:

```text
queue.add(name, data, options?)
```

Example:

```ts
await queue.add(
  "send-email",
  {
    to: "user@example.com",
    subject: "Welcome"
  }
);
```

The returned job contains information such as:

- job ID
- job name
- job data
- attempt count
- maximum attempts
- priority
- creation time
- scheduled time

---

# Job Options

Jobs can be configured with:

```ts
await queue.add(
  "send-email",
  {
    to: "user@example.com"
  },
  {
    priority: 10,
    delay: 5000,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  }
);
```

Available options:

| Option | Description |
|---|---|
| `priority` | Priority of the job. Higher values are processed first. |
| `delay` | Delay before the job becomes available. |
| `attempts` | Maximum number of processing attempts. |
| `backoff.type` | `fixed` or `exponential`. |
| `backoff.delay` | Base delay used between retries. |

---

# Priority Scheduling

Jobs can have different priorities.

```ts
await queue.add(
  "low-priority-job",
  {
    message: "Low priority"
  },
  {
    priority: 1
  }
);

await queue.add(
  "high-priority-job",
  {
    message: "High priority"
  },
  {
    priority: 10
  }
);
```

Higher-priority jobs are selected before lower-priority jobs when multiple jobs are waiting.

Priority is implemented using Redis sorted sets.

---

# Delayed Jobs

Jobs can be scheduled to become available in the future.

```ts
await queue.add(
  "send-reminder",
  {
    userId: "123"
  },
  {
    delay: 10000
  }
);
```

The example above delays the job for 10 seconds.

The delayed-job scheduler continuously checks for jobs whose scheduled time has arrived and moves them into the ready queue.

---

# Retries

Jobs can automatically retry when the processor throws an error.

```ts
await queue.add(
  "unstable-job",
  {
    value: 42
  },
  {
    attempts: 5
  }
);
```

If the processor fails, the job is returned to the queue until the maximum number of attempts is reached.

For example:

```text
Attempt 1 → Failed
Attempt 2 → Failed
Attempt 3 → Failed
Attempt 4 → Failed
Attempt 5 → Failed
             ↓
          Dead-Letter Queue
```

---

# Fixed Backoff

Fixed backoff uses the same delay between retries.

```ts
await queue.add(
  "api-request",
  {
    url: "https://example.com"
  },
  {
    attempts: 5,
    backoff: {
      type: "fixed",
      delay: 2000
    }
  }
);
```

Retry behavior:

```text
Failure
   ↓
Wait 2 seconds
   ↓
Retry
   ↓
Wait 2 seconds
   ↓
Retry
```

---

# Exponential Backoff

Exponential backoff increases the delay after every failure.

```ts
await queue.add(
  "api-request",
  {
    url: "https://example.com"
  },
  {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  }
);
```

The retry delays follow an exponential pattern:

```text
Attempt 1 → Failure
     ↓
   1 sec
     ↓
Attempt 2 → Failure
     ↓
   2 sec
     ↓
Attempt 3 → Failure
     ↓
   4 sec
     ↓
Attempt 4 → Failure
     ↓
   8 sec
```

This is useful for transient failures such as:

- temporary network failures
- unavailable external APIs
- database connection problems
- rate-limited services
- temporary infrastructure failures

---

# Dead-Letter Queue

When a job reaches its maximum number of attempts, it is moved to a dead-letter queue.

Example:

```ts
await queue.add(
  "payment-processing",
  {
    orderId: "123"
  },
  {
    attempts: 3
  }
);
```

If all three attempts fail, the job is moved to the queue's DLQ.

The Redis key follows:

```text
queue:<queue-name>:dlq
```

For example:

```text
queue:payments:dlq
```

A dead-letter queue prevents permanently failing jobs from continuously retrying.

It also provides a place where failed jobs can later be inspected or replayed by application-level tooling.

---

# Worker

A worker consumes jobs from a queue.

```ts
const worker = new Worker(
  "emails",
  async (job) => {
    console.log("Processing:", job.name);

    await sendEmail(job.data);
  },
  redis
);
```

The processor is supplied by the application.

The library invokes the processor whenever a job is successfully claimed.

---

# Worker Processor

The processor receives a `JobData` object.

```ts
const worker = new Worker(
  "emails",
  async (job) => {
    console.log(job.id);
    console.log(job.name);
    console.log(job.data);

    // Application-specific work
  },
  redis
);
```

The queue library does not know what your business logic does.

For example, the processor could:

- send an email
- generate a report
- resize an image
- process a payment
- call an external API
- perform a database operation
- execute an AI task

The queue is responsible for reliably delivering the job to the processor.

---

# Worker Concurrency

Workers can process multiple jobs concurrently.

```ts
const worker = new Worker(
  "emails",
  async (job) => {
    await sendEmail(job.data);
  },
  redis,
  {
    concurrency: 5
  }
);
```

With:

```ts
concurrency: 5
```

the worker can have up to five processing loops working concurrently.

This allows applications to increase throughput without creating a separate worker process for every job.

---

# Worker Configuration

Workers support:

```ts
const worker = new Worker(
  "emails",
  async (job) => {
    await sendEmail(job.data);
  },
  redis,
  {
    concurrency: 5,
    lockDuration: 30000,
    heartbeatInterval: 10000
  }
);
```

| Option | Default | Description |
|---|---:|---|
| `concurrency` | `1` | Number of concurrent processing loops. |
| `lockDuration` | `30000` ms | Duration of the processing lock. |
| `heartbeatInterval` | `10000` ms | Interval used to extend active job locks. |

---

# Visibility Timeout and Job Locks

When a worker claims a job, the job receives a temporary processing lock.

Conceptually:

```text
Ready
  ↓
Worker claims job
  ↓
Processing + Lock
  ↓
Heartbeat extends lock
  ↓
Success → Complete
```

The lock prevents another worker from immediately treating the same job as available while the original worker is processing it.

The lock has an expiration time.

---

# Worker Heartbeats

Long-running jobs need their processing lock to remain valid.

The worker periodically sends a heartbeat by extending the lock expiration time.

```text
Worker
  │
  ├── Claim Job
  │
  ├── Process
  │
  ├── Heartbeat → Extend Lock
  │
  ├── Heartbeat → Extend Lock
  │
  └── Complete
```

This allows jobs that take longer than the initial lock duration to continue processing safely.

---

# Stalled Job Recovery

A worker can disappear while processing a job because of:

- process crashes
- machine failures
- container termination
- network failures
- unexpected shutdowns

Without recovery, a job could remain stuck in the processing state.

This library detects expired processing locks.

Conceptually:

```text
Worker A
   │
   ├── Claims Job
   │
   ├── Processing
   │
   └── Worker disappears
          ↓
      Lock expires
          ↓
   Stalled Recovery
          ↓
      Ready Queue
          ↓
      Worker B
          ↓
       Processes
```

Stalled-job recovery uses an atomic Redis Lua script to verify the expired lock, remove the job from processing, clear the old lock information, and return the job to the ready queue.

This provides recovery without requiring a central database.

---

# Atomic Redis Operations

Important state transitions are implemented using Redis Lua scripts.

For example:

- adding jobs
- claiming jobs
- completing jobs
- retrying failed jobs
- moving jobs to the DLQ
- recovering stalled jobs

This allows multiple Redis operations to be executed atomically.

For example, claiming a job involves:

```text
Find job
   ↓
Remove from ready queue
   ↓
Add to processing
   ↓
Set lock
   ↓
Mark processing
```

These operations need to happen together to reduce race conditions between multiple workers.

---

# Graceful Shutdown

Workers support graceful shutdown.

```ts
await worker.close();
await redis.close();
```

The worker stops accepting new jobs and waits for currently active jobs to finish before closing.

Example:

```ts
process.on("SIGTERM", async () => {
  await worker.close();
  await redis.close();
});
```

This is useful when shutting down:

- Docker containers
- Kubernetes pods
- Node.js applications
- cloud services
- worker processes

---

# Redis Data Structures

The queue uses Redis data structures for different responsibilities.

Example queue keys:

```text
queue:<name>:id
queue:<name>:ready
queue:<name>:delayed
queue:<name>:processing
queue:<name>:dlq
```

Job metadata is stored using:

```text
job:<queue-name>:<job-id>
```

The implementation uses Redis:

- Sorted Sets for priority scheduling
- Sorted Sets for delayed jobs
- Lists for processing and DLQ tracking
- Hashes for job metadata
- Lua scripts for atomic state transitions

---

# Architecture

High-level architecture:

```text
                    Application
                         │
                         │ queue.add()
                         ▼
                    ┌─────────┐
                    │  Queue  │
                    └────┬────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    Redis    │
                  ├─────────────┤
                  │ Ready Jobs  │
                  │ Delayed     │
                  │ Processing  │
                  │ Job Data    │
                  │ DLQ         │
                  └──────┬──────┘
                         │
                         ▼
                    ┌─────────┐
                    │ Worker  │
                    └────┬────┘
                         │
                         ▼
                 Application
                  Processor
                         │
                 ┌───────┴───────┐
                 │               │
              Success          Failure
                 │               │
                 ▼               ▼
             Complete       Retry / Backoff
                                 │
                         ┌───────┴───────┐
                         │               │
                       Retry            Max Attempts
                         │               │
                         ▼               ▼
                      Ready             DLQ
```

---

# Multi-Worker Processing

Multiple worker instances can work on the same queue.

For example:

```text
                Redis
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    Worker A  Worker B  Worker C
```

All workers coordinate through Redis.

A job is atomically claimed from the ready queue and assigned to a worker.

This allows the queue to be used by multiple application processes or worker instances.

---

# TypeScript Support

The package ships with its own TypeScript declaration files.

No separate package such as:

```bash
@types/reliable-job-queue
```

is required.

Example:

```ts
import {
  Queue,
  Worker,
  RedisConnection,
  JobData,
  JobOptions,
} from "reliable-job-queue";
```

---

# Complete Example

```ts
import {
  Queue,
  Worker,
  RedisConnection,
} from "reliable-job-queue";

const redis = new RedisConnection(
  process.env.REDIS_URL ??
  "redis://localhost:6379"
);

const queue = new Queue(
  "emails",
  redis
);

const worker = new Worker(
  "emails",
  async (job) => {
    console.log(
      `Processing job ${job.id}`
    );

    console.log(
      `Job name: ${job.name}`
    );

    console.log(
      `Job data:`,
      job.data
    );

    // Your actual application logic
  },
  redis,
  {
    concurrency: 5
  }
);

await queue.add(
  "send-welcome-email",
  {
    to: "user@example.com"
  },
  {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  }
);

console.log("Job added");

process.on("SIGTERM", async () => {
  await worker.close();
  await redis.close();
});
```

---

# API Reference

## `RedisConnection`

```ts
new RedisConnection(url?)
```

Creates a Redis connection.

Default:

```text
redis://localhost:6379
```

Example:

```ts
const redis = new RedisConnection(
  "redis://localhost:6379"
);
```

---

## `Queue`

```ts
new Queue(
  name,
  redis
)
```

Creates a queue.

### `queue.add()`

```ts
queue.add(
  name,
  data,
  options?
)
```

Adds a job to the queue.

---

## `Worker`

```ts
new Worker(
  name,
  processor,
  redis,
  options?
)
```

Creates a worker that processes jobs from a queue.

### `worker.close()`

```ts
await worker.close();
```

Gracefully stops the worker.

---

# Job Options API

```ts
interface JobOptions {
  priority?: number;

  delay?: number;

  attempts?: number;

  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
}
```

---

# Job Data

```ts
interface JobData {
  id: string;
  name: string;
  data: Record<string, unknown>;

  attemptsMade: number;
  maxAttempts: number;

  priority: number;

  createdAt: number;
  scheduledAt: number;

  failedReason?: string;
}
```

---

# Requirements

- Node.js
- Redis 7+
- TypeScript (when using TypeScript)

---

# Project Goals

This project is designed to demonstrate reliable background job processing concepts including:

- distributed workers
- Redis-based coordination
- job scheduling
- priority queues
- retries
- exponential backoff
- dead-letter queues
- visibility timeouts
- worker heartbeats
- stalled-job recovery
- atomic state transitions
- concurrent job processing
- graceful shutdown
- reusable library design

The goal is to provide a lightweight, reusable queue abstraction while keeping the application-specific business logic inside the user's processor function.

---

# License

Proprietary.

---

## ⭐ Support the Project

If you find **Reliable Job Queue** useful, interesting, or helpful for learning about Redis-based job processing:

**Please consider giving the project a ⭐ star on GitHub!**

Your support helps the project grow and motivates further development.

If you use it in a project, feel free to share your experience or suggestions.

**Thanks for checking out Reliable Job Queue! 🚀**
