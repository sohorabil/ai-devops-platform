import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getAnthropicClient, CLAUDE_MODEL } from "@infrastructure/claude/anthropic-client.js";
import { logger } from "@infrastructure/logger.js";
import { sopGeneratedTotal } from "@infrastructure/metrics.js";

export interface PipelineFailure {
  readonly workflow: string;
  readonly job: string;
  readonly step: string;
  readonly errorOutput: string;
  readonly branch: string;
  readonly commitSha: string;
  readonly author: string;
  readonly repositoryUrl: string;
}

export interface SopResult {
  readonly filePath: string;
  readonly content: string;
  readonly title: string;
}

// Converts a failure description into a safe filename
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Asks Claude to write a professional SOP document for a pipeline failure
async function askClaudeForSop(failure: PipelineFailure): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `You are a Senior DevOps Engineer writing an SOP (Standard Operating Procedure) document.

A CI/CD pipeline has failed. Analyze the failure and write a clear, actionable SOP document in Markdown.

## Failure Details
- **Workflow:** ${failure.workflow}
- **Job:** ${failure.job}
- **Failed Step:** ${failure.step}
- **Branch:** ${failure.branch}
- **Commit:** ${failure.commitSha}
- **Author:** ${failure.author}
- **Repository:** ${failure.repositoryUrl}

## Error Output
\`\`\`
${failure.errorOutput}
\`\`\`

## SOP Document Requirements
Write a Markdown document with these exact sections:
1. **Title** — short, descriptive name for this failure type
2. **Summary** — 2-3 sentences explaining what happened and why
3. **Root Cause** — technical explanation of the underlying cause
4. **Impact** — what breaks if this is not fixed
5. **Step-by-Step Fix** — numbered list of exact commands/actions to resolve it
6. **Prevention** — how to prevent this from happening again
7. **Related SOPs** — links to related documents (use placeholder paths if unknown)

Write only the Markdown document. No preamble.`;

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned an unexpected response format");
  }

  return block.text;
}

// Determines which subfolder the SOP belongs in based on the failure type
function categorizeSop(failure: PipelineFailure): string {
  const step = failure.step.toLowerCase();
  if (step.includes("deploy") || step.includes("docker") || step.includes("push")) {
    return "deployment";
  }
  if (
    step.includes("test") ||
    step.includes("lint") ||
    step.includes("typecheck") ||
    step.includes("audit")
  ) {
    return "pipeline-failures";
  }
  return "general";
}

// Main entry point: generates SOP and saves it to docs/sops/
export async function generateSop(
  failure: PipelineFailure,
  projectRoot: string,
): Promise<SopResult> {
  logger.info(
    { workflow: failure.workflow, job: failure.job, step: failure.step },
    "Generating SOP",
  );

  const sopContent = await askClaudeForSop(failure);

  // Extract title from the first H1 heading in the generated document
  const titleMatch = /^#\s+(.+)$/m.exec(sopContent);
  const title = titleMatch?.[1] ?? `${failure.workflow} — ${failure.step} failure`;

  const category = categorizeSop(failure);
  const filename = `${toSlug(title)}.md`;
  const relativePath = join("docs", "sops", category, filename);
  const absolutePath = join(projectRoot, relativePath);

  await mkdir(join(projectRoot, "docs", "sops", category), { recursive: true });
  await writeFile(absolutePath, sopContent, "utf-8");

  sopGeneratedTotal.inc({ category });
  logger.info({ filePath: relativePath, title }, "SOP written to disk");

  return { filePath: relativePath, content: sopContent, title };
}
