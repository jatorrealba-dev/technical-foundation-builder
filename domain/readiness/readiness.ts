export const readinessDimensions = [
  "product",
  "domain",
  "architecture",
  "data",
  "security",
  "testing",
  "delivery",
  "operations",
] as const;

export type ReadinessDimension =
  (typeof readinessDimensions)[number];

export const readinessAssessmentSources = [
  "deterministic",
  "agent",
] as const;

export type ReadinessAssessmentSource =
  (typeof readinessAssessmentSources)[number];

export const readinessLevels = [
  "not_ready",
  "at_risk",
  "progressing",
  "ready_for_review",
  "ready",
] as const;

export type ReadinessLevel =
  (typeof readinessLevels)[number];

export const readinessPriorities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type ReadinessPriority =
  (typeof readinessPriorities)[number];

export const readinessBlockerStatuses = [
  "open",
  "accepted",
  "resolved",
  "dismissed",
] as const;

export type ReadinessBlockerStatus =
  (typeof readinessBlockerStatuses)[number];

export const readinessActionStatuses = [
  "pending",
  "in_progress",
  "completed",
  "dismissed",
] as const;

export type ReadinessActionStatus =
  (typeof readinessActionStatuses)[number];

export type ReadinessDimensionDraft = {
  key: ReadinessDimension;
  score: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
};

export type ReadinessBlockerDraft = {
  fingerprint: string;
  dimension: ReadinessDimension;
  title: string;
  reason: string;
  priority: ReadinessPriority;
  evidence: string[];
};

export type ReadinessActionDraft = {
  fingerprint: string;
  dimension: ReadinessDimension;
  action: string;
  ownerRole: string;
  expectedOutcome: string;
  priority: Exclude<ReadinessPriority, "critical">;
};

export type ReadinessAssessmentDraft = {
  source: ReadinessAssessmentSource;
  summary: string;
  overallScore: number;
  level: ReadinessLevel;
  confidence: number | null;
  dimensions: ReadinessDimensionDraft[];
  blockers: ReadinessBlockerDraft[];
  nextActions: ReadinessActionDraft[];
  evidenceSnapshot: Record<string, unknown>;
};

export function clampReadinessScore(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getReadinessLevel(
  score: number
): ReadinessLevel {
  const normalized = clampReadinessScore(score);

  if (normalized < 40) {
    return "not_ready";
  }

  if (normalized < 60) {
    return "at_risk";
  }

  if (normalized < 75) {
    return "progressing";
  }

  if (normalized < 90) {
    return "ready_for_review";
  }

  return "ready";
}

export function getReadinessLevelLabel(
  level: ReadinessLevel
): string {
  switch (level) {
    case "not_ready":
      return "No preparado";
    case "at_risk":
      return "En riesgo";
    case "progressing":
      return "En progreso";
    case "ready_for_review":
      return "Listo para revisión";
    case "ready":
      return "Listo";
  }
}

export function getReadinessDimensionLabel(
  dimension: ReadinessDimension
): string {
  const labels: Record<ReadinessDimension, string> = {
    product: "Producto",
    domain: "Dominio",
    architecture: "Arquitectura",
    data: "Datos",
    security: "Seguridad",
    testing: "Testing",
    delivery: "Entrega",
    operations: "Operación",
  };

  return labels[dimension];
}

export function isReadinessBlockerStatus(
  value: string
): value is ReadinessBlockerStatus {
  return readinessBlockerStatuses.includes(
    value as ReadinessBlockerStatus
  );
}

export function isReadinessActionStatus(
  value: string
): value is ReadinessActionStatus {
  return readinessActionStatuses.includes(
    value as ReadinessActionStatus
  );
}
