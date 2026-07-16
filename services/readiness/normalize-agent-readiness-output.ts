import type { ReadinessAgentOutput } from "@/schemas/agents/agent-outputs";
import {
  clampReadinessScore,
  getReadinessLevel,
  readinessDimensions,
  type ReadinessActionDraft,
  type ReadinessAssessmentDraft,
  type ReadinessBlockerDraft,
  type ReadinessDimension,
  type ReadinessDimensionDraft,
} from "../../domain/readiness/readiness.ts";

import { createReadinessFingerprint } from "./readiness-fingerprint.ts";

function normalizeDimension(
  key: ReadinessDimension,
  output: ReadinessAgentOutput
): ReadinessDimensionDraft {
  const dimension = output.dimensions.find(
    (candidate) => candidate.key === key
  );

  if (!dimension) {
    return {
      key,
      score: 0,
      rationale:
        "El agente no proporcionó una evaluación para esta dimensión.",
      evidence: [],
      gaps: [
        "Falta una evaluación explícita de esta dimensión.",
      ],
    };
  }

  return {
    key,
    score: clampReadinessScore(dimension.score),
    rationale: dimension.rationale,
    evidence: dimension.evidence,
    gaps: dimension.gaps,
  };
}

function inferBlockerDimension(
  blocker: ReadinessAgentOutput["blockers"][number]
): ReadinessDimension {
  const value = `${blocker.title} ${blocker.reason}`.toLowerCase();

  const candidates: Array<[
    ReadinessDimension,
    string[]
  ]> = [
    ["security", ["security", "seguridad", "privacy", "privacidad", "auth"]],
    ["data", ["data", "datos", "database", "persistencia"]],
    ["architecture", ["architecture", "arquitectura", "integration", "integración"]],
    ["testing", ["test", "testing", "prueba", "qa"]],
    ["delivery", ["delivery", "entrega", "backlog", "slice"]],
    ["operations", ["operations", "operación", "deployment", "despliegue", "monitoring"]],
    ["domain", ["domain", "dominio", "entity", "entidad"]],
  ];

  for (const [dimension, terms] of candidates) {
    if (terms.some((term) => value.includes(term))) {
      return dimension;
    }
  }

  return "product";
}

export function normalizeAgentReadinessOutput(
  output: ReadinessAgentOutput,
  sourceRunId: string
): ReadinessAssessmentDraft {
  const dimensions = readinessDimensions.map((dimension) =>
    normalizeDimension(dimension, output)
  );

  const blockerMap = new Map<string, ReadinessBlockerDraft>();

  for (const blocker of output.blockers) {
    const dimension = inferBlockerDimension(blocker);
    const fingerprint = createReadinessFingerprint(
      sourceRunId,
      dimension,
      blocker.title,
      blocker.reason
    );

    blockerMap.set(fingerprint, {
      fingerprint,
      dimension,
      title: blocker.title,
      reason: blocker.reason,
      priority: blocker.priority,
      evidence: [],
    });
  }

  const blockers = [...blockerMap.values()];
  const actionMap = new Map<string, ReadinessActionDraft>();

  for (const action of output.nextActions) {
    const dimension = inferBlockerDimension({
      title: action.action,
      reason: action.expectedOutcome,
      priority: action.priority,
    });
    const fingerprint = createReadinessFingerprint(
      sourceRunId,
      dimension,
      action.action,
      action.expectedOutcome
    );

    actionMap.set(fingerprint, {
      fingerprint,
      dimension,
      action: action.action,
      ownerRole: action.ownerRole,
      expectedOutcome: action.expectedOutcome,
      priority: action.priority,
    });
  }

  const nextActions = [...actionMap.values()];

  const averageScore = Math.round(
    dimensions.reduce(
      (total, dimension) => total + dimension.score,
      0
    ) / dimensions.length
  );

  const conservativeScore = Math.min(
    clampReadinessScore(output.overallScore),
    averageScore
  );

  return {
    source: "agent",
    summary: output.summary,
    overallScore: conservativeScore,
    level: getReadinessLevel(conservativeScore),
    confidence: output.confidence,
    dimensions,
    blockers,
    nextActions,
    evidenceSnapshot: {
      sourceRunId,
      normalizedAt: new Date().toISOString(),
      reportedOverallScore: output.overallScore,
      normalizedAverageScore: averageScore,
    },
  };
}
