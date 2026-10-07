import type { Redis } from "ioredis";

const CLAIM_JOB_SCRIPT = `
local jobId = redis.call("LPOP", KEYS[1])

if not jobId then
  return nil
end

local jobKey = ARGV[4] .. jobId

redis.call("RPUSH", KEYS[2], jobId)

redis.call(
  "HSET",
  jobKey,
  "status", "processing",
  "lockedBy", ARGV[1],
  "lockedAt", ARGV[2],
  "lockExpiresAt", ARGV[3]
)

return jobId
`;

export async function claimJob(
  client: Redis,
  readyKey: string,
  processingKey: string,
  jobKeyPrefix: string,
  workerId: string,
  now: number,
  lockDuration: number
): Promise<string | null> {
  const result = await client.eval(
    CLAIM_JOB_SCRIPT,
    2,
    readyKey,
    processingKey,
    workerId,
    String(now),
    String(now + lockDuration),
    jobKeyPrefix
  );

  return result ? String(result) : null;
}