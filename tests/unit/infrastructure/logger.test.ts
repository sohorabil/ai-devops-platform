import { describe, it, expect } from "vitest";
import { logger } from "@infrastructure/logger.js";

describe("logger", (): void => {
  it("should export a logger object", (): void => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe("object");
  });

  it("should expose standard pino log methods", (): void => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  it("should have log level set from config", (): void => {
    expect(logger.level).toBe("info");
  });
});
