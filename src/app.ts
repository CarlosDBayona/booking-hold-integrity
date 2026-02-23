import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { RedisLike } from "./services/lock-service";

export async function createApp(redis: RedisLike) {
  const app = await NestFactory.create(
    AppModule.register(redis),
    new ExpressAdapter(),
    { logger: false },
  );

  await app.init();

  return app.getHttpAdapter().getInstance();
}
