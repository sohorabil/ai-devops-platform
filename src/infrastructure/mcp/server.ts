import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkDependencies } from "@infrastructure/mcp/dependency-check.tool.js";
import { checkCodeQuality } from "@infrastructure/mcp/code-check.tool.js";
import { generateSop } from "@application/sop-writer.js";
import { commitAndPushSop } from "@infrastructure/git/git-ops.js";
import { logger } from "@infrastructure/logger.js";

const server = new McpServer({
  name: "ai-devops-platform",
  version: "0.1.0",
});

// Tool 1: OWASP equivalent — scans npm packages for known CVEs
server.tool(
  "check_dependencies",
  "Scan npm dependencies for known CVE vulnerabilities using npm audit. Returns a structured report with severity counts and fix availability.",
  {
    projectPath: z.string().describe("Absolute path to the Node.js project root"),
  },
  async ({
    projectPath,
  }): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> => {
    const result = await checkDependencies(projectPath);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool 2: SonarQube equivalent — runs ESLint + TypeScript type checker
server.tool(
  "check_code_quality",
  "Run ESLint and TypeScript type checking on a project. Returns lint errors, warnings, and type errors in structured format.",
  {
    projectPath: z.string().describe("Absolute path to the Node.js project root"),
  },
  async ({
    projectPath,
  }): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> => {
    const result = await checkCodeQuality(projectPath);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool 3: The SOP engine — diagnoses a pipeline failure, writes an SOP, pushes it to Git
server.tool(
  "sop_diagnose",
  "Diagnose a CI/CD pipeline failure, generate a Standard Operating Procedure (SOP) document using Claude AI, and push it to the repository so future engineers can find the solution instantly.",
  {
    workflow: z.string().describe("Name of the GitHub Actions workflow that failed"),
    job: z.string().describe("Name of the job that failed"),
    step: z.string().describe("Name of the step that failed"),
    errorOutput: z.string().describe("The full error output / logs from the failed step"),
    branch: z.string().describe("Git branch name"),
    commitSha: z.string().describe("The commit SHA that triggered the pipeline"),
    author: z.string().describe("The author of the commit"),
    repositoryUrl: z.string().describe("URL of the GitHub repository"),
    projectPath: z.string().describe("Absolute path to the project root on disk"),
    pushToGit: z
      .boolean()
      .default(true)
      .describe("Whether to commit and push the SOP to Git (default: true)"),
  },
  async ({
    workflow,
    job,
    step,
    errorOutput,
    branch,
    commitSha,
    author,
    repositoryUrl,
    projectPath,
    pushToGit,
  }): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> => {
    const failure = {
      workflow,
      job,
      step,
      errorOutput,
      branch,
      commitSha,
      author,
      repositoryUrl,
    };

    const sopResult = await generateSop(failure, projectPath);

    let gitResult: { sha: string; message: string; filesChanged: string[] } | null = null;
    if (pushToGit) {
      gitResult = await commitAndPushSop(sopResult.filePath, sopResult.title, projectPath);
    }

    const response = {
      sopTitle: sopResult.title,
      sopFilePath: sopResult.filePath,
      sopContent: sopResult.content,
      git: gitResult,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started — tools: check_dependencies, check_code_quality, sop_diagnose");
}

main().catch((err: unknown) => {
  logger.error({ err }, "MCP server failed to start");
  process.exit(1);
});
