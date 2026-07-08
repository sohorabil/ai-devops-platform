// CLI entry point called by GitHub Actions when CI fails.
// Reads flags from argv, generates SOP via Claude, pushes to Git.
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateSop } from "@application/sop-writer.js";
import { commitAndPushSop } from "@infrastructure/git/git-ops.js";
import { logger } from "@infrastructure/logger.js";

async function readErrorLog(projectRoot: string): Promise<string> {
  // In CI the error output is piped to a temp file by the workflow
  try {
    const logPath = join(projectRoot, ".ci-error.log");
    return await readFile(logPath, "utf-8");
  } catch {
    return "Error log not available — check GitHub Actions logs directly.";
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      workflow: { type: "string", default: "CI" },
      job: { type: "string", default: "unknown-job" },
      step: { type: "string", default: "unknown-step" },
      branch: { type: "string", default: "main" },
      commit: { type: "string", default: "" },
      author: { type: "string", default: "unknown" },
      repo: { type: "string", default: "" },
    },
  });

  const projectRoot = process.cwd();
  const errorOutput = await readErrorLog(projectRoot);

  const failure = {
    workflow: values.workflow ?? "CI",
    job: values.job ?? "unknown-job",
    step: values.step ?? "unknown-step",
    errorOutput,
    branch: values.branch ?? "main",
    commitSha: values.commit ?? "",
    author: values.author ?? "unknown",
    repositoryUrl: values.repo ?? "",
  };

  logger.info(failure, "Starting CI diagnosis");

  const sopResult = await generateSop(failure, projectRoot);
  logger.info({ title: sopResult.title, filePath: sopResult.filePath }, "SOP generated");

  const gitResult = await commitAndPushSop(sopResult.filePath, sopResult.title, projectRoot);
  logger.info({ sha: gitResult.sha }, "SOP pushed to repository");

  process.stdout.write(
    `\n✅ SOP written: ${sopResult.filePath}\n📝 Title: ${sopResult.title}\n🔗 Commit: ${gitResult.sha}\n`,
  );
}

main().catch((err: unknown) => {
  logger.error({ err }, "CI diagnosis failed");
  process.exit(1);
});
