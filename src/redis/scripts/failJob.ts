import type { Redis } from "ioredis";

const FAIL_JOB_SCRIPT = `
local jobKey = KEYS[1]
local processingKey = KEYS[2]
local readyKey = KEYS[3]
local delayedKey = KEYS[4]
local dlqKey = KEYS[5]

local jobId = ARGV[1]
local workerId = ARGV[2]
local now = tonumber(ARGV[3])

local lockedBy = redis.call("HGET", jobKey, "lockedBy")

if lockedBy ~= workerId then
  return 0
end

local attemptsMade =
  redis.call("HINCRBY", jobKey, "attemptsMade", 1)

local maxAttempts =
  tonumber(redis.call("HGET", jobKey, "maxAttempts"))

local backoffType =
  redis.call("HGET", jobKey, "backoffType")

local backoffDelay =
  tonumber(redis.call("HGET", jobKey, "backoffDelay")) or 0

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

if attemptsMade >= maxAttempts then

  redis.call(
    "HSET",
    jobKey,
    "status", "dead-letter",
    "failedReason", ARGV[4],
    "failedAt", tostring(now)
  )

  redis.call(
    "RPUSH",
    dlqKey,
    jobId
  )

  return 2
end

local delay = backoffDelay

if backoffType == "exponential" then
  delay = backoffDelay * (2 ^ (attemptsMade - 1))
end

local scheduledAt = now + delay

redis.call(
  "HSET",
  jobKey,
  "status", "waiting",
  "scheduledAt", tostring(scheduledAt),
  "failedReason", ARGV[4]
)

if delay <= 0 then

local priority =
tonumber(redis.call(
  "HGET",
  jobKey,
  "priority"
)) or 0

redis.call(
"ZADD",
readyKey,
-priority,
jobId
)

else

  redis.call(
    "ZADD",
    delayedKey,
    scheduledAt,
    jobId
  )

end

return 1
`;

export async function failJob(
  client: Redis,
  jobKey: string,
  processingKey: string,
  readyKey: string,
  delayedKey: string,
  dlqKey: string,
  jobId: string,
  workerId: string,
  reason: string
): Promise<number> {
  const result = await client.eval(
    FAIL_JOB_SCRIPT,
    5,
    jobKey,
    processingKey,
    readyKey,
    delayedKey,
    dlqKey,
    jobId,
    workerId,
    String(Date.now()),
    reason
  );

  return Number(result);
}