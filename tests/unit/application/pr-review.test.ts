import { describe, it, expect } from "vitest";
import { formatReviewComment } from "@application/pr-review.js";
import type { CodeCheckResult } from "@infrastructure/mcp/code-check.tool.js";
import type { DependencyCheckResult } from "@infrastructure/mcp/dependency-check.tool.js";

const FIXED_DATE = new Date("2026-06-29T10:00:00.000Z");

const passingCode: CodeCheckResult = {
  lintIssues: [],
  typeErrors: [],
  errorCount: 0,
  warningCount: 0,
  passed: true,
  summary: "ESLint: 0 errors, 0 warnings | TypeScript: 0 type errors | Status: PASSED",
};

const passingDeps: DependencyCheckResult = {
  vulnerabilities: [],
  totalCount: 0,
  criticalCount: 0,
  highCount: 0,
  passed: true,
};

describe("formatReviewComment", (): void => {
  it("should show PASS and all green checkmarks when all checks pass", (): void => {
    const comment = formatReviewComment(passingCode, passingDeps, FIXED_DATE);
    expect(comment).toContain("PASS");
    expect(comment).not.toContain("FAIL");
    expect(comment).toContain("✅");
    expect(comment).not.toContain("❌");
  });

  it("should show FAIL when ESLint has errors", (): void => {
    const failCode: CodeCheckResult = { ...passingCode, errorCount: 3, passed: false };
    const comment = formatReviewComment(failCode, passingDeps, FIXED_DATE);
    expect(comment).toContain("FAIL");
    expect(comment).toContain("❌");
  });

  it("should show FAIL when TypeScript has errors", (): void => {
    const failCode: CodeCheckResult = {
      ...passingCode,
      typeErrors: ["src/index.ts(1,1): error TS2345"],
      passed: false,
    };
    const comment = formatReviewComment(failCode, passingDeps, FIXED_DATE);
    expect(comment).toContain("FAIL");
    expect(comment).toContain("❌");
  });

  it("should show FAIL when critical CVEs exist", (): void => {
    const failDeps: DependencyCheckResult = {
      ...passingDeps,
      criticalCount: 2,
      highCount: 1,
      passed: false,
    };
    const comment = formatReviewComment(passingCode, failDeps, FIXED_DATE);
    expect(comment).toContain("FAIL");
    expect(comment).toContain("❌");
  });

  it("should include the ISO timestamp", (): void => {
    const comment = formatReviewComment(passingCode, passingDeps, FIXED_DATE);
    expect(comment).toContain("2026-06-29T10:00:00.000Z");
  });

  it("should include error and warning counts in the ESLint row", (): void => {
    const code: CodeCheckResult = {
      ...passingCode,
      errorCount: 5,
      warningCount: 12,
      passed: false,
    };
    const comment = formatReviewComment(code, passingDeps, FIXED_DATE);
    expect(comment).toContain("5 errors");
    expect(comment).toContain("12 warnings");
  });

  it("should include CVE counts in the Dependencies row", (): void => {
    const deps: DependencyCheckResult = {
      ...passingDeps,
      criticalCount: 1,
      highCount: 4,
      passed: false,
    };
    const comment = formatReviewComment(passingCode, deps, FIXED_DATE);
    expect(comment).toContain("1 critical");
    expect(comment).toContain("4 high");
  });

  it("should include the section heading", (): void => {
    const comment = formatReviewComment(passingCode, passingDeps, FIXED_DATE);
    expect(comment).toContain("## AI DevOps Platform — PR Review");
  });
});
