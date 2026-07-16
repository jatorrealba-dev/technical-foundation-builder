import type { ArtifactType } from "@/domain/artifacts/artifact";

export const consistencySeverities = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type ConsistencySeverity =
  (typeof consistencySeverities)[number];

export const consistencyCategories = [
  "requirement_gap",
  "domain_gap",
  "data_gap",
  "security_gap",
  "architecture_gap",
  "delivery_gap",
  "contradiction",
  "stale_artifact",
] as const;

export type ConsistencyCategory =
  (typeof consistencyCategories)[number];

export const consistencyFindingStatuses = [
  "open",
  "accepted",
  "dismissed",
  "resolved",
] as const;

export type ConsistencyFindingStatus =
  (typeof consistencyFindingStatuses)[number];

export const consistencyScanSources = [
  "deterministic",
  "agent",
] as const;

export type ConsistencyScanSource =
  (typeof consistencyScanSources)[number];

export type ConsistencyFindingDraft = {
  fingerprint: string;
  ruleKey: string;
  source: ConsistencyScanSource;
  severity: ConsistencySeverity;
  category: ConsistencyCategory;
  title: string;
  description: string;
  evidence: string[];
  affectedArtifactTypes: ArtifactType[];
  recommendation: string;
};

export type ConsistencyScanSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  byCategory: Record<ConsistencyCategory, number>;
};

export function isConsistencyFindingStatus(
  value: string
): value is ConsistencyFindingStatus {
  return consistencyFindingStatuses.includes(
    value as ConsistencyFindingStatus
  );
}

export function summarizeConsistencyFindings(
  findings: readonly ConsistencyFindingDraft[]
): ConsistencyScanSummary {
  const summary: ConsistencyScanSummary = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    byCategory: {
      requirement_gap: 0,
      domain_gap: 0,
      data_gap: 0,
      security_gap: 0,
      architecture_gap: 0,
      delivery_gap: 0,
      contradiction: 0,
      stale_artifact: 0,
    },
  };

  for (const finding of findings) {
    summary[finding.severity] += 1;
    summary.byCategory[finding.category] += 1;
  }

  return summary;
}
