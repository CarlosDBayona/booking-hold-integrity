import Redis from "ioredis";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

export function createRedisClient(): Redis {
  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const port = Number(process.env.REDIS_PORT ?? "6379");

  return new Redis({ host, port, maxRetriesPerRequest: 2 });
}
