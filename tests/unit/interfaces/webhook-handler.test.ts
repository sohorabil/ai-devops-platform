import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifySignature } from "@interfaces/webhook-handler.js";

const SECRET = "test-webhook-secret";
const PAYLOAD = Buffer.from('{"ref":"refs/heads/main","zen":"test"}');

function makeSignature(body: Buffer, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifySignature", (): void => {
  it("should return true for a valid HMAC-SHA256 signature", (): void => {
    const sig = makeSignature(PAYLOAD, SECRET);
    expect(verifySignature(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it("should return false for a tampered payload", (): void => {
    const sig = makeSignature(PAYLOAD, SECRET);
    const tampered = Buffer.from('{"ref":"refs/heads/evil"}');
    expect(verifySignature(tampered, sig, SECRET)).toBe(false);
  });

  it("should return false when signature header is undefined", (): void => {
    expect(verifySignature(PAYLOAD, undefined, SECRET)).toBe(false);
  });

  it("should return false when signature has wrong prefix", (): void => {
    const hex = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");
    expect(verifySignature(PAYLOAD, `md5=${hex}`, SECRET)).toBe(false);
  });

  it("should return false for an empty signature string", (): void => {
    expect(verifySignature(PAYLOAD, "", SECRET)).toBe(false);
  });

  it("should return false when signature is for a different secret", (): void => {
    const sig = makeSignature(PAYLOAD, "wrong-secret");
    expect(verifySignature(PAYLOAD, sig, SECRET)).toBe(false);
  });
});
