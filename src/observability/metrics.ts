import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const holdCreatedCounter = new Counter({
  name: "reservation_lock_created_total",
  help: "Total de locks creados",
  registers: [registry],
});

export const holdRejectedCounter = new Counter({
  name: "reservation_lock_rejected_total",
  help: "Total de intents rechazados por lock",
  registers: [registry],
});

export const confirmSuccessCounter = new Counter({
  name: "reservation_confirm_success_total",
  help: "Total de confirmaciones exitosas",
  registers: [registry],
});

export const holdLatencyHistogram = new Histogram({
  name: "reservation_hold_latency_ms",
  help: "Latencia de hold en ms",
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});

export const confirmLatencyHistogram = new Histogram({
  name: "reservation_confirm_latency_ms",
  help: "Latencia de confirm en ms",
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});
