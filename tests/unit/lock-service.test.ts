import Redis from "ioredis-mock";
import { describe, expect, it } from "vitest";
import { LockService } from "../../src/services/lock-service";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("LockService", () => {
  it("acquires lock once and rejects second hold without TTL renewal", async () => {
    const redis = new Redis();
    const lockService = new LockService(redis as never);
    const skuId = `SKU-123-${Date.now()}`;

    const first = await lockService.acquireLock(skuId, { userId: "user-1", cartId: "cart-A" }, 20);
    const firstTtl = first.lock?.ttlSecondsRemaining ?? 0;

    await wait(1100);

    const second = await lockService.acquireLock(skuId, { userId: "user-2", cartId: "cart-B" }, 20);

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.lock?.payload.userId).toBe("user-1");
    expect(second.lock?.payload.cartId).toBe("cart-A");
    expect(second.lock?.ttlSecondsRemaining).toBeLessThanOrEqual(firstTtl);
  });

  it("expires lock by TTL and allows new hold", async () => {
    const redis = new Redis();
    const lockService = new LockService(redis as never);
    const skuId = `SKU-EXP-${Date.now()}`;

    const first = await lockService.acquireLock(skuId, { userId: "user-1", cartId: "cart-A" }, 1);
    expect(first.acquired).toBe(true);

    await wait(1200);

    const second = await lockService.acquireLock(skuId, { userId: "user-2", cartId: "cart-B" }, 1);
    expect(second.acquired).toBe(true);
    expect(second.lock?.payload.userId).toBe("user-2");
  });

  it("releases lock explicitly", async () => {
    const redis = new Redis();
    const lockService = new LockService(redis as never);
    const skuId = `SKU-REL-${Date.now()}`;

    await lockService.acquireLock(skuId, { userId: "user-1", cartId: "cart-A" }, 30);
    const released = await lockService.releaseLock(skuId);
    const lock = await lockService.getLock(skuId);

    expect(released).toBe(true);
    expect(lock).toBeUndefined();
  });
});
