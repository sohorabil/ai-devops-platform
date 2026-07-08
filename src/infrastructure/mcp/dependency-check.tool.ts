import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@infrastructure/logger.js";

const execFileAsync = promisify(execFile);

export interface DependencyVulnerability {
  readonly name: string;
  readonly severity: "critical" | "high" | "moderate" | "low" | "info";
  readonly via: string[];
  readonly fixAvailable: boolean;
  readonly url: string;
}

export interface DependencyCheckResult {
  readonly vulnerabilities: DependencyVulnerability[];
  readonly totalCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly passed: boolean;
}

// npm audit exits with a non-zero code when vulnerabilities exist.
// We catch that, read stdout anyway, and parse the JSON ourselves.
async function runNpmAudit(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("npm", ["audit", "--json"], {
      cwd: projectPath,
    });
    return stdout;
  } catch (err: unknown) {
    if (err instanceof Error && "stdout" in err) {
      return String((err as NodeJS.ErrnoException & { stdout: unknown }).stdout);
    }
    return "{}";
  }
}

export async function checkDependencies(projectPath: string): Promise<DependencyCheckResult> {
  logger.info({ projectPath }, "Running dependency vulnerability check");

  const rawOutput = await runNpmAudit(projectPath);

  const audit = JSON.parse(rawOutput) as {
    vulnerabilities?: Record<
      string,
      {
        severity: string;
        via: Array<string | { name: string }>;
        fixAvailable: boolean | { name: string };
        url?: string;
      }
    >;
  };

  const vulns: DependencyVulnerability[] = Object.entries(audit.vulnerabilities ?? {}).map(
    ([name, v]) => ({
      name,
      severity: v.severity as DependencyVulnerability["severity"],
      via: v.via.map((x) => (typeof x === "string" ? x : x.name)),
      fixAvailable: v.fixAvailable !== false,
      url: v.url ?? `https://www.npmjs.com/advisories/search?q=${name}`,
    }),
  );

  const criticalCount = vulns.filter((v) => v.severity === "critical").length;
  const highCount = vulns.filter((v) => v.severity === "high").length;

  const result: DependencyCheckResult = {
    vulnerabilities: vulns,
    totalCount: vulns.length,
    criticalCount,
    highCount,
    passed: criticalCount === 0 && highCount === 0,
  };

  logger.info(
    {
      totalCount: result.totalCount,
      criticalCount,
      highCount,
      passed: result.passed,
    },
    "Dependency check complete",
  );

  return result;
}
