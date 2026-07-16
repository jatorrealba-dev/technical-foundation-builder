import type {
  DiscoveryArtifactReadinessRow,
  DiscoveryContradictionRow,
  DiscoveryCoverageRow,
  DiscoveryGapRow,
  DiscoveryKnowledgeRow,
  DiscoveryMessageRow,
  DiscoverySessionRow,
} from "./discovery-persistence";

export type DiscoveryRuntimeContext = {
  session: DiscoverySessionRow;
  messages: DiscoveryMessageRow[];
  knowledge: DiscoveryKnowledgeRow[];
  gaps: DiscoveryGapRow[];
  contradictions: DiscoveryContradictionRow[];
  coverage: DiscoveryCoverageRow[];
  artifactReadiness: DiscoveryArtifactReadinessRow[];
};

export function parseDiscoveryRuntimeContext(
  value: unknown
): DiscoveryRuntimeContext {
  if (!value || typeof value !== "object") {
    throw new Error("El contexto de Discovery no tiene un formato válido.");
  }

  const context = value as Partial<DiscoveryRuntimeContext>;

  if (!context.session || !Array.isArray(context.messages)) {
    throw new Error("El contexto de Discovery está incompleto.");
  }

  return {
    session: context.session,
    messages: context.messages,
    knowledge: context.knowledge ?? [],
    gaps: context.gaps ?? [],
    contradictions: context.contradictions ?? [],
    coverage: context.coverage ?? [],
    artifactReadiness: context.artifactReadiness ?? [],
  };
}
