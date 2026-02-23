import { LockAcquireResult, LockPayload, ParsedLock } from "../types";

export interface RedisLike {
  set(key: string, value: string, mode: "EX", duration: number, condition: "NX"): Promise<"OK" | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
}

export class LockService {
  private readonly keyPrefix = "lock:sku:";

  constructor(private readonly redis: RedisLike) {}

  private getKey(skuId: string): string {
    return `${this.keyPrefix}${skuId}`;
  }

  async acquireLock(skuId: string, payload: Omit<LockPayload, "createdAt" | "skuId">, ttlSeconds = 900): Promise<LockAcquireResult> {
    const key = this.getKey(skuId);
    const lockPayload: LockPayload = {
      skuId,
      userId: payload.userId,
      cartId: payload.cartId,
      createdAt: new Date().toISOString(),
    };

    const setResult = await this.redis.set(key, JSON.stringify(lockPayload), "EX", ttlSeconds, "NX");

    if (setResult === "OK") {
      const ttl = await this.redis.ttl(key);
      return {
        acquired: true,
        lock: {
          payload: lockPayload,
          ttlSecondsRemaining: Math.max(ttl, 0),
        },
      };
    }

    return {
      acquired: false,
      lock: await this.getLock(skuId),
    };
  }

  async getLock(skuId: string): Promise<ParsedLock | undefined> {
    const key = this.getKey(skuId);
    const raw = await this.redis.get(key);
    if (!raw) {
      return undefined;
    }

    const ttl = await this.redis.ttl(key);
    return {
      payload: JSON.parse(raw) as LockPayload,
      ttlSecondsRemaining: Math.max(ttl, 0),
    };
  }

  async releaseLock(skuId: string): Promise<boolean> {
    const key = this.getKey(skuId);
    const deleted = await this.redis.del(key);
    return deleted > 0;
  }
}
