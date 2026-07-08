import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@infrastructure/logger.js";

const execFileAsync = promisify(execFile);

export interface LintIssue {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly severity: "error" | "warning";
  readonly rule: string;
  readonly message: string;
}

export interface CodeCheckResult {
  readonly lintIssues: LintIssue[];
  readonly typeErrors: string[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly passed: boolean;
  readonly summary: string;
}

async function runLint(projectPath: string): Promise<LintIssue[]> {
  try {
    const { stdout } = await execFileAsync("npx", ["eslint", ".", "--format", "json"], {
      cwd: projectPath,
    });
    const results = JSON.parse(stdout) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        severity: number;
        ruleId: string | null;
        message: string;
      }>;
    }>;

    return results.flatMap((file) =>
      file.messages.map((m) => ({
        file: file.filePath,
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? ("error" as const) : ("warning" as const),
        rule: m.ruleId ?? "unknown",
        message: m.message,
      })),
    );
  } catch (err: unknown) {
    // ESLint exits non-zero on lint errors — parse stdout anyway
    const stdout =
      err instanceof Error && "stdout" in err
        ? String((err as NodeJS.ErrnoException & { stdout: unknown }).stdout)
        : "[]";
    const parsed: unknown = JSON.parse(stdout);
    return Array.isArray(parsed) ? (parsed as LintIssue[]) : [];
  }
}

async function runTypecheck(projectPath: string): Promise<string[]> {
  try {
    await execFileAsync("npx", ["tsc", "--noEmit"], { cwd: projectPath });
    return [];
  } catch (err: unknown) {
    const output =
      err instanceof Error && "stdout" in err
        ? String((err as NodeJS.ErrnoException & { stdout: unknown }).stdout)
        : "";
    return output.split("\n").filter(Boolean);
  }
}

export async function checkCodeQuality(projectPath: string): Promise<CodeCheckResult> {
  logger.info({ projectPath }, "Running code quality check");

  const [lintIssues, typeErrors] = await Promise.all([
    runLint(projectPath),
    runTypecheck(projectPath),
  ]);

  const errorCount = lintIssues.filter((i) => i.severity === "error").length;
  const warningCount = lintIssues.filter((i) => i.severity === "warning").length;
  const passed = errorCount === 0 && typeErrors.length === 0;

  const summary = [
    `ESLint: ${errorCount.toString()} errors, ${warningCount.toString()} warnings`,
    `TypeScript: ${typeErrors.length.toString()} type errors`,
    `Status: ${passed ? "PASSED" : "FAILED"}`,
  ].join(" | ");

  logger.info(
    { errorCount, warningCount, typeErrorCount: typeErrors.length, passed },
    "Code check complete",
  );

  return { lintIssues, typeErrors, errorCount, warningCount, passed, summary };
}
