import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GitHubEventType, WebhookEvent } from "@domain/webhook-event.js";
import { runPrReview } from "@application/pr-review.js";
import { checkCodeQuality } from "@infrastructure/mcp/code-check.tool.js";
import { config } from "@infrastructure/config.js";
import { logger } from "@infrastructure/logger.js";
import { webhookRequestsTotal, webhookDurationSeconds } from "@infrastructure/metrics.js";

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

export function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);

  // timingSafeEqual requires identical lengths — check first to avoid RangeError
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}

function parseEventType(header: string | undefined): GitHubEventType {
  if (header === "push") return "push";
  if (header === "pull_request") return "pull_request";
  if (header === "ping") return "ping";
  return "unknown";
}

function extractRepoInfo(payload: Record<string, unknown>): { owner: string; repo: string } | null {
  const repository = payload["repository"];
  if (typeof repository !== "object" || repository === null) return null;

  const fullName = (repository as Record<string, unknown>)["full_name"];
  if (typeof fullName !== "string") return null;

  const parts = fullName.split("/");
  if (parts.length !== 2) return null;

  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;

  return { owner, repo };
}

function extractPrNumber(payload: Record<string, unknown>): number | null {
  const pr = payload["pull_request"];
  if (typeof pr !== "object" || pr === null) return null;

  const number = (pr as Record<string, unknown>)["number"];
  if (typeof number !== "number") return null;

  return number;
}

async function dispatch(event: WebhookEvent): Promise<void> {
  const projectPath = process.cwd();

  if (event.eventType === "ping") {
    logger.info(
      { deliveryId: event.deliveryId },
      "GitHub ping received — webhook configured successfully",
    );
    return;
  }

  if (event.eventType === "push") {
    logger.info({ deliveryId: event.deliveryId }, "Push event — running code quality check");
    const result = await checkCodeQuality(projectPath);
    logger.info(
      { passed: result.passed, errorCount: result.errorCount, deliveryId: event.deliveryId },
      "Push code quality check complete",
    );
    return;
  }

  if (event.eventType === "pull_request") {
    const action = event.payload["action"];
    if (action !== "opened" && action !== "synchronize") {
      logger.debug({ action, deliveryId: event.deliveryId }, "PR action ignored");
      return;
    }

    const repoInfo = extractRepoInfo(event.payload);
    const prNumber = extractPrNumber(event.payload);

    if (!repoInfo || prNumber === null) {
      logger.warn(
        { deliveryId: event.deliveryId },
        "Could not extract repo info from PR payload — skipping review",
      );
      return;
    }

    await runPrReview(projectPath, repoInfo.owner, repoInfo.repo, prNumber);
    return;
  }

  logger.debug(
    { eventType: event.eventType, deliveryId: event.deliveryId },
    "Unhandled event type",
  );
}

export async function handleWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let rawBody: Buffer;

  try {
    rawBody = await readBody(req);
  } catch (err: unknown) {
    const isTooBig = err instanceof Error && err.message === "Request body too large";
    res.writeHead(isTooBig ? 413 : 400);
    res.end();
    return;
  }

  const signatureHeader = req.headers["x-hub-signature-256"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (config.GITHUB_WEBHOOK_SECRET) {
    if (!verifySignature(rawBody, signature, config.GITHUB_WEBHOOK_SECRET)) {
      logger.warn("Webhook signature verification failed — request rejected");
      webhookRequestsTotal.inc({ event_type: "unknown", status: "rejected" });
      res.writeHead(401);
      res.end();
      return;
    }
  } else {
    logger.warn("GITHUB_WEBHOOK_SECRET not set — skipping signature verification");
  }

  const eventTypeHeader = req.headers["x-github-event"];
  const eventTypeRaw = Array.isArray(eventTypeHeader) ? eventTypeHeader[0] : eventTypeHeader;
  const eventType = parseEventType(eventTypeRaw);

  const deliveryHeader = req.headers["x-github-delivery"];
  const deliveryId = Array.isArray(deliveryHeader)
    ? (deliveryHeader[0] ?? "unknown")
    : (deliveryHeader ?? "unknown");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf-8")) as Record<string, unknown>;
  } catch {
    logger.warn({ deliveryId }, "Failed to parse webhook JSON body");
    res.writeHead(400);
    res.end();
    return;
  }

  const event: WebhookEvent = {
    eventType,
    deliveryId,
    payload,
    receivedAt: new Date(),
  };

  // Respond immediately — GitHub expects a fast acknowledgment
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ received: true, deliveryId }));

  const endTimer = webhookDurationSeconds.startTimer({ event_type: event.eventType });
  dispatch(event)
    .then(() => {
      endTimer();
      webhookRequestsTotal.inc({ event_type: event.eventType, status: "ok" });
    })
    .catch((err: unknown) => {
      endTimer();
      webhookRequestsTotal.inc({ event_type: event.eventType, status: "error" });
      logger.error({ err, deliveryId }, "Webhook dispatch failed");
    });
}
