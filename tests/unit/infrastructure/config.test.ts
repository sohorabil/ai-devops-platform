import { describe, it, expect } from "vitest";
import { ConfigSchema } from "@infrastructure/config.js";

describe("ConfigSchema", (): void => {
  describe("defaults", (): void => {
    it("should apply default PORT of 3000", (): void => {
      const result = ConfigSchema.parse({});
      expect(result.PORT).toBe(3000);
    });

    it("should apply default NODE_ENV of development", (): void => {
      const result = ConfigSchema.parse({});
      expect(result.NODE_ENV).toBe("development");
    });

    it("should apply default LOG_LEVEL of info", (): void => {
      const result = ConfigSchema.parse({});
      expect(result.LOG_LEVEL).toBe("info");
    });
  });

  describe("coercion", (): void => {
    it("should coerce PORT from string to number", (): void => {
      const result = ConfigSchema.parse({ PORT: "8080" });
      expect(result.PORT).toBe(8080);
    });
  });

  describe("validation failures", (): void => {
    it("should reject an invalid NODE_ENV value", (): void => {
      const result = ConfigSchema.safeParse({ NODE_ENV: "invalid-env" });
      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric PORT string", (): void => {
      const result = ConfigSchema.safeParse({ PORT: "not-a-port" });
      expect(result.success).toBe(false);
    });

    it("should reject a negative PORT", (): void => {
      const result = ConfigSchema.safeParse({ PORT: "-1" });
      expect(result.success).toBe(false);
    });
  });

  describe("valid full config", (): void => {
    it("should parse a complete valid config", (): void => {
      const result = ConfigSchema.parse({
        PORT: "4000",
        NODE_ENV: "production",
        LOG_LEVEL: "warn",
      });
      expect(result.PORT).toBe(4000);
      expect(result.NODE_ENV).toBe("production");
      expect(result.LOG_LEVEL).toBe("warn");
    });
  });
});
