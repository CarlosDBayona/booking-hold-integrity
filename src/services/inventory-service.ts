import { Inject, Injectable } from "@nestjs/common";
import { REDIS_CLIENT } from "../redis";
import { RedisLike } from "./lock-service";

interface ReservedPayload {
  skuId: string;
  confirmedAt: string;
  userId: string;
  cartId: string;
}

@Injectable()
export class InventoryService {
  private readonly reservedPrefix = "reserved:sku:";

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisLike) {}

  private getReservedKey(skuId: string): string {
    return `${this.reservedPrefix}${skuId}`;
  }

  async isReserved(skuId: string): Promise<boolean> {
    const raw = await this.redis.get(this.getReservedKey(skuId));
    return Boolean(raw);
  }

  async markReserved(skuId: string, userId: string, cartId: string): Promise<boolean> {
    const payload: ReservedPayload = {
      skuId,
      userId,
      cartId,
      confirmedAt: new Date().toISOString(),
    };

    const result = await this.redis.set(this.getReservedKey(skuId), JSON.stringify(payload), "EX", 86400, "NX");
    return result === "OK";
  }
}
