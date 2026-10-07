import type { Redis } from "ioredis";

const COMPLETE_JOB_SCRIPT = `
local jobKey = KEYS[1]
local processingKey = KEYS[2]
local jobId = ARGV[1]
local now = ARGV[2]
local workerId = ARGV[3]

local lockedBy = redis.call("HGET", jobKey, "lockedBy")

if lockedBy ~= workerId then
  return 0
end

redis.call(
  "HSET",
  jobKey,
  "status", "completed",
  "completedAt", now
)

redis.call(
  "LREM",
  processingKey,
  1,
  jobId
)

redis.call(
  "HDEL",
  jobKey,
  "lockedBy",
  "lockedAt",
  "lockExpiresAt"
)

return 1
`;

export async function completeJob(
  client: Redis,
  jobKey: string,
  processingKey: string,
  jobId: string,
  workerId: string
): Promise<boolean> {
  const result = await client.eval(
    COMPLETE_JOB_SCRIPT,
    2,
    jobKey,
    processingKey,
    jobId,
    String(Date.now()),
    workerId
  );

  return Number(result) === 1;
}