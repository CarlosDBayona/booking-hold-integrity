import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: true,
  base: {
    service: "reservation-lock-api",
  },
});
