import { z } from "zod";
import dotenv from "dotenv";

// Load .env file only outside production so secrets are never read from a file on the server
if (process.env["NODE_ENV"] !== "production") {
  dotenv.config();
}

// ConfigSchema defines the shape and rules for every environment variable.
// Zod validates these at startup — if anything is wrong the process exits immediately.
export const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production", "staging"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  // Required for Claude AI features — get yours at console.anthropic.com
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Git identity for automated SOP commits
  GIT_AUTHOR_NAME: z.string().default("AI DevOps Platform"),
  GIT_AUTHOR_EMAIL: z.string().default("devops-bot@ai-platform.local"),
  // GitHub webhook HMAC secret — set in repo Settings → Webhooks
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  // GitHub token for posting PR review comments
  GITHUB_TOKEN: z.string().min(1).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Readonly<Config> {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    process.stderr.write(`[config] Invalid environment configuration:\n${result.error.message}\n`);
    process.exit(1);
  }
  return Object.freeze(result.data);
}

// Single, frozen config object — imported by everything else in the app
export const config: Readonly<Config> = loadConfig();
