import type { Redis } from "ioredis";

const ADD_JOB_SCRIPT = `
local jobId = redis.call(
  "INCR",
  KEYS[1]
)

local jobKey = ARGV[1] .. jobId
local readyKey = KEYS[2]
local delayedKey = KEYS[3]

local name = ARGV[2]
local data = ARGV[3]
local maxAttempts = ARGV[4]
local priority = ARGV[5]
local createdAt = ARGV[6]
local scheduledAt = ARGV[7]
local backoffType = ARGV[8]
local backoffDelay = ARGV[9]

redis.call(
  "HSET",
  jobKey,
  "id", tostring(jobId),
  "name", tostring(name),
  "data", tostring(data),
  "attemptsMade", "0",
  "maxAttempts", tostring(maxAttempts),
  "priority", tostring(priority),
  "createdAt", tostring(createdAt),
  "scheduledAt", tostring(scheduledAt),
  "backoffType", tostring(backoffType),
  "backoffDelay", tostring(backoffDelay),
  "status", "waiting"
)

if tonumber(scheduledAt) > tonumber(createdAt) then

  redis.call(
    "ZADD",
    delayedKey,
    tonumber(scheduledAt),
    tostring(jobId)
  )

else

  local priorityScore =
    -tonumber(priority)

  redis.call(
    "ZADD",
    readyKey,
    priorityScore,
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
    String(backoffDelay)
  );

  return String(result);
}