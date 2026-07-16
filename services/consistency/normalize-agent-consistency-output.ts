import {
  artifactCatalog,
} from "../../domain/artifacts/artifact-catalog.ts";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { ConsistencyFindingDraft } from "@/domain/consistency/consistency";
import type { ConsistencyAgentOutput } from "@/schemas/agents/agent-outputs";

import {
  createConsistencyFingerprint,
  normalizeConsistencyText,
} from "./consistency-fingerprint.ts";

function resolveArtifactType(
  value: string
): ArtifactType | null {
  const normalized = normalizeConsistencyText(value);

  for (const artifact of artifactCatalog) {
    const candidates = [
      artifact.type,
      artifact.title,
      artifact.filename,
    ].map(normalizeConsistencyText);

    if (
      candidates.some(
        (candidate) =>
          normalized === candidate ||
          normalized.includes(candidate) ||
          candidate.includes(normalized)
      )
    ) {
      return artifact.type;
    }
  }

  return null;
}

export function normalizeAgentConsistencyOutput(
  output: ConsistencyAgentOutput
): ConsistencyFindingDraft[] {
  return output.issues.map((issue) => {
    const affectedArtifactTypes = Array.from(
      new Set(
        issue.affectedArtifacts
          .map(resolveArtifactType)
          .filter(
            (value): value is ArtifactType => value !== null
          )
      )
    );

    return {
      fingerprint: createConsistencyFingerprint(
        "agent",
        issue.category,
        issue.description,
        affectedArtifactTypes
      ),
      ruleKey: `agent:${issue.id}`,
      source: "agent",
      severity: issue.severity,
      category: issue.category,
      title:
        issue.description.length > 140
          ? `${issue.description.slice(0, 137)}...`
          : issue.description,
      description: issue.description,
      evidence: issue.evidence,
      affectedArtifactTypes,
      recommendation: issue.recommendation,
    };
  });
}
