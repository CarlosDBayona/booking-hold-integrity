import request from "supertest";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createApp } from "../../src/app";

const runDockerTests = process.env.RUN_DOCKER_TESTS === "1";
const describeOrSkip = runDockerTests ? describe : describe.skip;

describeOrSkip("Reservation API integration (Redis docker)", () => {
  let container: StartedTestContainer;
  let redis: Redis;

  beforeAll(async () => {
    container = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();

    redis = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    });

    process.env.LOCK_TTL_SECONDS = "900";
  });

  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });

  it("rejects second hold for same SKU and keeps first owner", async () => {
    const app = createApp(redis as never);

    const first = await request(app)
      .post("/reservations/hold")
      .send({ skuId: "SKU-123", userId: "user-1", cartId: "cart-A" });

    const second = await request(app)
      .post("/reservations/hold")
      .send({ skuId: "SKU-123", userId: "user-2", cartId: "cart-B" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.reason).toBe("SKU_LOCKED");

    const rawLock = await redis.get("lock:sku:SKU-123");
    expect(rawLock).toBeTruthy();
    expect(rawLock).toContain("user-1");
    expect(rawLock).toContain("cart-A");
  });

  it("confirms reservation and releases lock", async () => {
    const app = createApp(redis as never);

    await request(app)
      .post("/reservations/hold")
      .send({ skuId: "SKU-200", userId: "user-9", cartId: "cart-Z" })
      .expect(201);

    const confirm = await request(app)
      .post("/reservations/confirm")
      .send({ skuId: "SKU-200", userId: "user-9", cartId: "cart-Z" });

    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe("CONFIRMED");

    const lock = await redis.get("lock:sku:SKU-200");
    const reserved = await redis.get("reserved:sku:SKU-200");

    expect(lock).toBeNull();
    expect(reserved).toBeTruthy();
  });
});
