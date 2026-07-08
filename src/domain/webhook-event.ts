export type GitHubEventType = "push" | "pull_request" | "ping" | "unknown";

export interface WebhookEvent {
  readonly eventType: GitHubEventType;
  readonly deliveryId: string;
  readonly payload: Record<string, unknown>;
  readonly receivedAt: Date;
}
