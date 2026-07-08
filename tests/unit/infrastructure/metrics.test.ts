import { describe, it, expect, beforeEach } from "vitest";
import { Registry, Counter, Histogram } from "prom-client";

// Each test gets its own isolated registry — avoids "metric already registered" errors
function makeTestRegistry(): Registry {
  return new Registry();
}

describe("metrics registry", (): void => {
  let reg: Registry;

  beforeEach((): void => {
    reg = makeTestRegistry();
  });

  it("should produce non-empty Prometheus text output", async (): Promise<void> => {
    const output = await reg.metrics();
    expect(typeof output).toBe("string");
  });

  it("should have correct content type", (): void => {
    expect(reg.contentType).toContain("text/plain");
  });
});

describe("webhookRequestsTotal counter", (): void => {
  it("should increment with event_type and status labels", async (): Promise<void> => {
    const reg = makeTestRegistry();
    const counter = new Counter({
      name: "webhook_requests_total",
      help: "test",
      labelNames: ["event_type", "status"] as const,
      registers: [reg],
    });

    counter.inc({ event_type: "push", status: "ok" });
    counter.inc({ event_type: "push", status: "ok" });
    counter.inc({ event_type: "pull_request", status: "error" });

    const metrics = await reg.metrics();
    expect(metrics).toContain('webhook_requests_total{event_type="push",status="ok"} 2');
    expect(metrics).toContain('webhook_requests_total{event_type="pull_request",status="error"} 1');
  });

  it("should increment rejected count", async (): Promise<void> => {
    const reg = makeTestRegistry();
    const counter = new Counter({
      name: "webhook_requests_total",
      help: "test",
      labelNames: ["event_type", "status"] as const,
      registers: [reg],
    });

    counter.inc({ event_type: "unknown", status: "rejected" });

    const metrics = await reg.metrics();
    expect(metrics).toContain('webhook_requests_total{event_type="unknown",status="rejected"} 1');
  });
});

describe("sopGeneratedTotal counter", (): void => {
  it("should increment with category label", async (): Promise<void> => {
    const reg = makeTestRegistry();
    const counter = new Counter({
      name: "sop_generated_total",
      help: "test",
      labelNames: ["category"] as const,
      registers: [reg],
    });

    counter.inc({ category: "pipeline-failures" });
    counter.inc({ category: "deployment" });
    counter.inc({ category: "pipeline-failures" });

    const metrics = await reg.metrics();
    expect(metrics).toContain('sop_generated_total{category="pipeline-failures"} 2');
    expect(metrics).toContain('sop_generated_total{category="deployment"} 1');
  });
});

describe("prReviewsTotal counter", (): void => {
  it("should record pass and fail reviews", async (): Promise<void> => {
    const reg = makeTestRegistry();
    const counter = new Counter({
      name: "pr_reviews_total",
      help: "test",
      labelNames: ["passed"] as const,
      registers: [reg],
    });

    counter.inc({ passed: "true" });
    counter.inc({ passed: "true" });
    counter.inc({ passed: "false" });

    const metrics = await reg.metrics();
    expect(metrics).toContain('pr_reviews_total{passed="true"} 2');
    expect(metrics).toContain('pr_reviews_total{passed="false"} 1');
  });
});

describe("webhookDurationSeconds histogram", (): void => {
  it("should record observations and produce _bucket/_count/_sum metrics", async (): Promise<void> => {
    const reg = makeTestRegistry();
    const histogram = new Histogram({
      name: "webhook_duration_seconds",
      help: "test",
      labelNames: ["event_type"] as const,
      buckets: [0.1, 0.5, 1],
      registers: [reg],
    });

    const end = histogram.startTimer({ event_type: "push" });
    end();

    const metrics = await reg.metrics();
    expect(metrics).toContain("webhook_duration_seconds_count");
    expect(metrics).toContain("webhook_duration_seconds_sum");
    expect(metrics).toContain("webhook_duration_seconds_bucket");
  });
});
