import { DynamicModule, Module } from "@nestjs/common";
import { AppController } from "./controllers/app-controller";
import { ReservationController } from "./controllers/reservation-controller";
import { REDIS_CLIENT } from "./redis";
import { InventoryService } from "./services/inventory-service";
import { LockService, RedisLike } from "./services/lock-service";

@Module({})
export class AppModule {
  static register(redis: RedisLike): DynamicModule {
    return {
      module: AppModule,
      controllers: [AppController, ReservationController],
      providers: [
        { provide: REDIS_CLIENT, useValue: redis },
        LockService,
        InventoryService,
      ],
    };
  }
}