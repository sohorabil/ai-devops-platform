import { describe, it, expect } from "vitest";

describe("Platform bootstrap", () => {
  it("should have access to process environment", () => {
    expect(typeof process.env).toBe("object");
  });

  it("should have a valid NODE_ENV when set", () => {
    const env = process.env["NODE_ENV"] ?? "development";
    expect(["development", "test", "production", "staging"]).toContain(env);
  });
});
