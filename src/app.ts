import express from "express";
import { createReservationRouter } from "./controllers/reservation-controller";
import { registry } from "./observability/metrics";
import { InventoryService } from "./services/inventory-service";
import { LockService, RedisLike } from "./services/lock-service";

export function createApp(redis: RedisLike) {
  const app = express();

  app.use(express.json());

  const lockService = new LockService(redis);
  const inventoryService = new InventoryService(redis);

  app.use("/reservations", createReservationRouter(lockService, inventoryService));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", registry.contentType);
    res.status(200).send(await registry.metrics());
  });

  return app;
}
