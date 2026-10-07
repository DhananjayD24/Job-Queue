import type { Redis } from "ioredis";

const ADD_JOB_SCRIPT = `
local jobId = redis.call("INCR", KEYS[1])

local jobKey = ARGV[1] .. jobId
local queueReadyKey = ARGV[2]
local queueDelayedKey = ARGV[3]

redis.call(
  "HSET",
  jobKey,
  "id", tostring(jobId),
  "name", ARGV[4],
  "data", ARGV[5],
  "attemptsMade", "0",
  "maxAttempts", ARGV[6],
  "priority", ARGV[7],
  "createdAt", ARGV[8],
  "scheduledAt", ARGV[9],
  "backoffType", ARGV[10],
  "backoffDelay", ARGV[11],
  "status", ARGV[12]
)

if tonumber(ARGV[9]) > tonumber(ARGV[8]) then
  redis.call(
    "ZADD",
    queueDelayedKey,
    ARGV[9],
    tostring(jobId)
  )
else
  redis.call(
    "RPUSH",
    queueReadyKey,
    tostring(jobId)
  )
end

return tostring(jobId)
`;

export async function addJob(
  client: Redis,
  idKey: string,
  readyKey: string,
  delayedKey: string,
  jobKeyPrefix: string,
  name: string,
  data: Record<string, unknown>,
  maxAttempts: number,
  priority: number,
  createdAt: number,
  scheduledAt: number,
  backoffType: "fixed" | "exponential",
  backoffDelay: number
): Promise<string> {
  const result = await client.eval(
    ADD_JOB_SCRIPT,
    3,
    idKey,
    readyKey,
    delayedKey,
    jobKeyPrefix,
    name,
    JSON.stringify(data),
    String(maxAttempts),
    String(priority),
    String(createdAt),
    String(scheduledAt),
    backoffType,
    String(backoffDelay),
    scheduledAt > createdAt
      ? "waiting"
      : "waiting"
  );

  return String(result);
}