import { RedisConnection } from "./RedisConnection.js";

const redis = new RedisConnection();

const client = redis.getClient();

const response = await client.ping();

console.log(response);

await redis.close();