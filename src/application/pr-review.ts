import { checkCodeQuality } from "@infrastructure/mcp/code-check.tool.js";
import { checkDependencies } from "@infrastructure/mcp/dependency-check.tool.js";
import type { CodeCheckResult } from "@infrastructure/mcp/code-check.tool.js";
import type { DependencyCheckResult } from "@infrastructure/mcp/dependency-check.tool.js";
import { postPrComment } from "@infrastructure/github/github-api.js";
import { logger } from "@infrastructure/logger.js";
import { prReviewsTotal } from "@infrastructure/metrics.js";

export interface PrReviewResult {
  readonly commentBody: string;
  readonly codeCheck: CodeCheckResult;
  readonly depCheck: DependencyCheckResult;
  readonly passed: boolean;
}

export function formatReviewComment(
  codeCheck: CodeCheckResult,
  depCheck: DependencyCheckResult,
  timestamp: Date,
): string {
  const eslintStatus = codeCheck.errorCount === 0 ? "✅" : "❌";
  const tsStatus = codeCheck.typeErrors.length === 0 ? "✅" : "❌";
  const depStatus = depCheck.criticalCount === 0 && depCheck.highCount === 0 ? "✅" : "❌";
  const passed = codeCheck.passed && depCheck.passed;
  const overallStatus = passed ? "✅" : "❌";
  const overallLabel = passed ? "PASS" : "FAIL";

  return [
    "## AI DevOps Platform — PR Review",
    "",
    "| Check | Result | Details |",
    "|-------|--------|---------|",
    `| ESLint | ${eslintStatus} | ${codeCheck.errorCount.toString()} errors, ${codeCheck.warningCount.toString()} warnings |`,
    `| TypeScript | ${tsStatus} | ${codeCheck.typeErrors.length.toString()} type errors |`,
    `| Dependencies | ${depStatus} | ${depCheck.criticalCount.toString()} critical, ${depCheck.highCount.toString()} high CVEs |`,
    `| **Overall** | ${overallStatus} **${overallLabel}** | |`,
    "",
    `_Reviewed at: ${timestamp.toISOString()}_`,
  ].join("\n");
}

export async function runPrReview(
  projectPath: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrReviewResult> {
  logger.info({ owner, repo, prNumber }, "Starting PR review");

  const [codeCheck, depCheck] = await Promise.all([
    checkCodeQuality(projectPath),
    checkDependencies(projectPath),
  ]);

  const commentBody = formatReviewComment(codeCheck, depCheck, new Date());
  const passed = codeCheck.passed && depCheck.passed;

  await postPrComment({ owner, repo, prNumber, body: commentBody });

  prReviewsTotal.inc({ passed: passed ? "true" : "false" });
  logger.info({ owner, repo, prNumber, passed }, "PR review complete");

  return { commentBody, codeCheck, depCheck, passed };
}
