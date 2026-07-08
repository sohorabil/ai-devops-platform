import type { IncomingMessage, ServerResponse } from "node:http";
import { registry } from "@infrastructure/metrics.js";
import { logger } from "@infrastructure/logger.js";

export async function handleMetricsRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const metrics = await registry.metrics();
    res.writeHead(200, { "Content-Type": registry.contentType });
    res.end(metrics);
  } catch (err: unknown) {
    logger.error({ err }, "Failed to collect metrics");
    res.writeHead(500);
    res.end();
  }
}
