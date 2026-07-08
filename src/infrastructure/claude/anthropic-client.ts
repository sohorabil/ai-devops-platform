import Anthropic from "@anthropic-ai/sdk";
import { config } from "@infrastructure/config.js";
import { logger } from "@infrastructure/logger.js";

// Lazily created — only instantiated when the key is available
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client !== null) {
    return _client;
  }

  if (!config.ANTHROPIC_API_KEY) {
    const msg =
      "[anthropic] ANTHROPIC_API_KEY is not set. Add it to your .env file or environment.\n";
    process.stderr.write(msg);
    logger.error("ANTHROPIC_API_KEY missing — Claude features unavailable");
    throw new Error("ANTHROPIC_API_KEY is required for Claude AI features");
  }

  _client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  logger.info("Anthropic client initialized");
  return _client;
}

// The model to use for all Claude calls in this platform
export const CLAUDE_MODEL = "claude-sonnet-4-6" as const;
