import type { Redis } from "ioredis";

const RECOVER_STALLED_JOB_SCRIPT = `
local jobKey = KEYS[1]
local processingKey = KEYS[2]
local readyKey = KEYS[3]

local jobId = ARGV[1]
local now = tonumber(ARGV[2])

local lockExpiresAt =
  tonumber(redis.call(
    "HGET",
    jobKey,
    "lockExpiresAt"
  ))

if not lockExpiresAt then
  return 0
end

if lockExpiresAt > now then
  return 0
end

local status =
  redis.call(
    "HGET",
    jobKey,
    "status"
  )

if status ~= "processing" then
  return 0
end

local removed =
  redis.call(
    "LREM",
    processingKey,
    1,
    jobId
  )

if removed ~= 1 then
  return 0
end

local priority =
  tonumber(
    redis.call(
      "HGET",
      jobKey,
      "priority"
    )
  ) or 0

redis.call(
  "HSET",
  jobKey,
  "status",
  "waiting"
)

redis.call(
  "HDEL",
  jobKey,
  "lockedBy",
  "lockedAt",
  "lockExpiresAt"
)

redis.call(
  "ZADD",
  readyKey,
  -priority,
  jobId
)

return 1
`;

export async function recoverStalledJob(
  client: Redis,
  jobKey: string,
  processingKey: string,
  readyKey: string,
  jobId: string
): Promise<boolean> {
  const result = await client.eval(
    RECOVER_STALLED_JOB_SCRIPT,
    3,
    jobKey,
    processingKey,
    readyKey,
    jobId,
    String(Date.now())
  );

  return Number(result) === 1;
}