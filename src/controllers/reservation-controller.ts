import { Router } from "express";
import { confirmLatencyHistogram, confirmSuccessCounter, holdCreatedCounter, holdLatencyHistogram, holdRejectedCounter } from "../observability/metrics";
import { logger } from "../observability/logger";
import { InventoryService } from "../services/inventory-service";
import { LockService } from "../services/lock-service";
import { CancelRequest, ConfirmRequest, HoldRequest, HoldResponse } from "../types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createReservationRouter(lockService: LockService, inventoryService: InventoryService): Router {
  const router = Router();

  router.post("/hold", async (req, res) => {
    const start = Date.now();
    const body = req.body as Partial<HoldRequest>;

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      return res.status(400).json({ reason: "INVALID_PAYLOAD" });
    }

    if (await inventoryService.isReserved(body.skuId)) {
      return res.status(409).json({ reason: "SKU_CONSUMED" });
    }

    const result = await lockService.acquireLock(
      body.skuId,
      { userId: body.userId, cartId: body.cartId },
      Number(process.env.LOCK_TTL_SECONDS ?? 900),
    );

    holdLatencyHistogram.observe(Date.now() - start);

    if (!result.acquired) {
      holdRejectedCounter.inc();
      logger.warn({
        skuId: body.skuId,
        lockRejected: true,
        ttlSecondsRemaining: result.lock?.ttlSecondsRemaining,
      }, "Lock rejected");

      const response: HoldResponse = {
        status: "HOLD_REJECTED",
        skuId: body.skuId,
        reason: "SKU_LOCKED",
        ttlSecondsRemaining: result.lock?.ttlSecondsRemaining,
      };

      return res.status(409).json(response);
    }

    holdCreatedCounter.inc();
    logger.info({
      skuId: body.skuId,
      lockCreated: true,
      ttlSecondsRemaining: result.lock?.ttlSecondsRemaining,
    }, "Lock created");

    const response: HoldResponse = {
      status: "HOLD_CREATED",
      skuId: body.skuId,
      ttlSecondsRemaining: result.lock?.ttlSecondsRemaining,
    };

    return res.status(201).json(response);
  });

  router.post("/confirm", async (req, res) => {
    const start = Date.now();
    const body = req.body as Partial<ConfirmRequest>;

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      return res.status(400).json({ reason: "INVALID_PAYLOAD" });
    }

    const lock = await lockService.getLock(body.skuId);
    if (!lock) {
      return res.status(409).json({ reason: "SKU_LOCK_MISSING" });
    }

    if (lock.payload.userId !== body.userId || lock.payload.cartId !== body.cartId) {
      return res.status(409).json({ reason: "SKU_LOCK_OWNERSHIP_MISMATCH" });
    }

    const reserved = await inventoryService.markReserved(body.skuId, body.userId, body.cartId);
    if (!reserved) {
      return res.status(409).json({ reason: "SKU_ALREADY_RESERVED" });
    }

    await lockService.releaseLock(body.skuId);
    confirmLatencyHistogram.observe(Date.now() - start);
    confirmSuccessCounter.inc();

    logger.info({ skuId: body.skuId, confirmed: true }, "Reservation confirmed");

    return res.status(200).json({ status: "CONFIRMED", skuId: body.skuId });
  });

  router.post("/cancel", async (req, res) => {
    const body = req.body as Partial<CancelRequest>;

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      return res.status(400).json({ reason: "INVALID_PAYLOAD" });
    }

    const lock = await lockService.getLock(body.skuId);
    if (!lock) {
      return res.status(404).json({ reason: "SKU_LOCK_NOT_FOUND" });
    }

    if (lock.payload.userId !== body.userId || lock.payload.cartId !== body.cartId) {
      return res.status(409).json({ reason: "SKU_LOCK_OWNERSHIP_MISMATCH" });
    }

    await lockService.releaseLock(body.skuId);
    logger.info({ skuId: body.skuId, canceled: true }, "Reservation canceled and lock released");

    return res.status(200).json({ status: "CANCELED", skuId: body.skuId });
  });

  return router;
}
