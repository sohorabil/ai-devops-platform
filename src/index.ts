import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "@infrastructure/config.js";
import { logger } from "@infrastructure/logger.js";
import { handleWebhookRequest } from "@interfaces/webhook-handler.js";
import { handleMetricsRequest } from "@interfaces/metrics-handler.js";

function router(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "ai-devops-platform", version: "0.1.0" }));
    return;
  }

  if (method === "GET" && url === "/metrics") {
    handleMetricsRequest(req, res).catch((err: unknown) => {
      logger.error({ err }, "Unhandled error in metrics handler");
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    });
    return;
  }

  if (method === "POST" && url === "/webhook/github") {
    handleWebhookRequest(req, res).catch((err: unknown) => {
      logger.error({ err }, "Unhandled error in webhook handler");
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
}

function bootstrap(): void {
  const server = createServer(router);

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, "ai-devops-platform v0.1.0 listening");
  });
}

bootstrap();
