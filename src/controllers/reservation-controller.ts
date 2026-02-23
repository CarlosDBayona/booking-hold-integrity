import { Body, Controller, HttpCode, HttpException, HttpStatus, Inject, Post } from "@nestjs/common";
import {
  confirmLatencyHistogram,
  confirmSuccessCounter,
  holdCreatedCounter,
  holdLatencyHistogram,
  holdRejectedCounter,
} from "../observability/metrics";
import { logger } from "../observability/logger";
import { InventoryService } from "../services/inventory-service";
import { LockService } from "../services/lock-service";
import { CancelRequest, ConfirmRequest, HoldRequest, HoldResponse } from "../types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

@Controller("reservations")
export class ReservationController {
  constructor(
    @Inject(LockService) private readonly lockService: LockService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  @Post("hold")
  async hold(@Body() body: Partial<HoldRequest>) {
    const start = Date.now();

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      throw new HttpException({ reason: "INVALID_PAYLOAD" }, HttpStatus.BAD_REQUEST);
    }

    if (await this.inventoryService.isReserved(body.skuId)) {
      throw new HttpException({ reason: "SKU_CONSUMED" }, HttpStatus.CONFLICT);
    }

    const result = await this.lockService.acquireLock(
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

      throw new HttpException(response, HttpStatus.CONFLICT);
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

    return response;
  }

  @Post("confirm")
  @HttpCode(200)
  async confirm(@Body() body: Partial<ConfirmRequest>) {
    const start = Date.now();

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      throw new HttpException({ reason: "INVALID_PAYLOAD" }, HttpStatus.BAD_REQUEST);
    }

    const lock = await this.lockService.getLock(body.skuId);
    if (!lock) {
      throw new HttpException({ reason: "SKU_LOCK_MISSING" }, HttpStatus.CONFLICT);
    }

    if (lock.payload.userId !== body.userId || lock.payload.cartId !== body.cartId) {
      throw new HttpException({ reason: "SKU_LOCK_OWNERSHIP_MISMATCH" }, HttpStatus.CONFLICT);
    }

    const reserved = await this.inventoryService.markReserved(body.skuId, body.userId, body.cartId);
    if (!reserved) {
      throw new HttpException({ reason: "SKU_ALREADY_RESERVED" }, HttpStatus.CONFLICT);
    }

    await this.lockService.releaseLock(body.skuId);
    confirmLatencyHistogram.observe(Date.now() - start);
    confirmSuccessCounter.inc();

    logger.info({ skuId: body.skuId, confirmed: true }, "Reservation confirmed");

    return { status: "CONFIRMED", skuId: body.skuId };
  }

  @Post("cancel")
  @HttpCode(200)
  async cancel(@Body() body: Partial<CancelRequest>) {

    if (!isNonEmptyString(body.skuId) || !isNonEmptyString(body.userId) || !isNonEmptyString(body.cartId)) {
      throw new HttpException({ reason: "INVALID_PAYLOAD" }, HttpStatus.BAD_REQUEST);
    }

    const lock = await this.lockService.getLock(body.skuId);
    if (!lock) {
      throw new HttpException({ reason: "SKU_LOCK_NOT_FOUND" }, HttpStatus.NOT_FOUND);
    }

    if (lock.payload.userId !== body.userId || lock.payload.cartId !== body.cartId) {
      throw new HttpException({ reason: "SKU_LOCK_OWNERSHIP_MISMATCH" }, HttpStatus.CONFLICT);
    }

    await this.lockService.releaseLock(body.skuId);
    logger.info({ skuId: body.skuId, canceled: true }, "Reservation canceled and lock released");

    return { status: "CANCELED", skuId: body.skuId };
  }
}
