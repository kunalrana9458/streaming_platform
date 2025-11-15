import client, { Registry } from "prom-client";

const register = new Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
export const mediaJobsTotal = new client.Counter({
  name: "media_jobs_total",
  help: "Total number of media processing jobs",
  labelNames: ["status"],
  registers: [register],
});

export const mediaJobDuration = new client.Histogram({
  name: "media_job_duration_seconds",
  help: "Duration of media processing jobs in seconds",
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const queueDepth = new client.Gauge({
  name: "bull_queue_depth",
  help: "BullMQ queue job counts",
  labelNames: ["queue"],
  registers: [register],
});

export function getMetrics() {
  return register.metrics();
}

export default { register, getMetrics };
