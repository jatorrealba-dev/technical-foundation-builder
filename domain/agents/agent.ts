export const agentKeys = [
  "discovery",
  "interview",
  "project_model",
  "architecture",
  "security",
  "consistency",
  "readiness",
] as const;

export type AgentKey = (typeof agentKeys)[number];

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentReviewDecision =
  | "pending"
  | "approved"
  | "rejected";

export type AgentApplicationStatus =
  | "not_applied"
  | "applying"
  | "applied"
  | "failed"
  | "not_applicable";

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  description: string;
  promptVersion: string;
  requiresProjectModel: boolean;
  requiresArtifacts: boolean;
};

export type AgentRunSummary = {
  id: string;
  projectId: string;
  agentKey: AgentKey;
  status: AgentRunStatus;
  provider: string;
  model: string;
  promptVersion: string;
  output: unknown;
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  createdBy: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type AgentRunReview = {
  id: string;
  runId: string;
  projectId: string;
  decision: AgentReviewDecision;
  reviewerComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  applicationStatus: AgentApplicationStatus;
  applicationSummary: Record<string, unknown>;
  appliedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isAgentKey(
  value: string
): value is AgentKey {
  return agentKeys.includes(value as AgentKey);
}

export function isAgentReviewDecision(
  value: string
): value is Exclude<AgentReviewDecision, "pending"> {
  return value === "approved" || value === "rejected";
}
