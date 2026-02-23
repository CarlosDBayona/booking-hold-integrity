import { createApp } from "./app";
import { logger } from "./observability/logger";
import { createRedisClient } from "./redis";

const port = Number(process.env.PORT ?? "3000");
const redis = createRedisClient();

const app = createApp(redis);

const server = app.listen(port, () => {
  logger.info({ port }, "Reservation lock API started");
});

const shutdown = async () => {
  logger.info("Shutting down server");
  server.close(async () => {
    await redis.quit();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
