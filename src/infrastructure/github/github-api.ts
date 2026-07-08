import { config } from "@infrastructure/config.js";
import { logger } from "@infrastructure/logger.js";

export interface PrCommentPayload {
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly body: string;
}

export async function postPrComment(payload: PrCommentPayload): Promise<void> {
  if (!config.GITHUB_TOKEN) {
    logger.warn(
      { owner: payload.owner, repo: payload.repo, prNumber: payload.prNumber },
      "GITHUB_TOKEN not set — skipping PR comment",
    );
    return;
  }

  const url = `https://api.github.com/repos/${payload.owner}/${payload.repo}/issues/${payload.prNumber.toString()}/comments`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ body: payload.body }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(
      { status: response.status, body: text, owner: payload.owner, repo: payload.repo },
      "Failed to post PR comment",
    );
    throw new Error(`GitHub API error ${response.status.toString()}: ${text}`);
  }

  logger.info(
    { owner: payload.owner, repo: payload.repo, prNumber: payload.prNumber },
    "PR comment posted",
  );
}
