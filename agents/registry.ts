import type {
  AgentDefinition,
  AgentKey,
} from "@/domain/agents/agent";

export const agentCatalog: readonly AgentDefinition[] = [
  {
    key: "interview",
    name: "Interview Strategist",
    description:
      "Detecta vacíos y propone preguntas adaptativas sin repetir información ya confirmada.",
    promptVersion: "interview.v2",
    requiresProjectModel: false,
    requiresArtifacts: false,
  },
  {
    key: "project_model",
    name: "Project Model Analyst",
    description:
      "Convierte evidencia del proyecto en requisitos, supuestos, entidades, riesgos y preguntas abiertas.",
    promptVersion: "project-model.v1",
    requiresProjectModel: false,
    requiresArtifacts: false,
  },
  {
    key: "architecture",
    name: "Architecture Specialist",
    description:
      "Propone límites, componentes, contratos, decisiones y riesgos arquitectónicos revisables.",
    promptVersion: "architecture.v1",
    requiresProjectModel: true,
    requiresArtifacts: false,
  },
  {
    key: "security",
    name: "Security Reviewer",
    description:
      "Clasifica datos, identifica hallazgos y propone controles verificables sin afirmar cumplimiento.",
    promptVersion: "security.v1",
    requiresProjectModel: true,
    requiresArtifacts: false,
  },
  {
    key: "consistency",
    name: "Consistency Reviewer",
    description:
      "Compara el Project Model y los documentos para detectar contradicciones, gaps y artefactos obsoletos.",
    promptVersion: "consistency.v1",
    requiresProjectModel: true,
    requiresArtifacts: true,
  },
  {
    key: "readiness",
    name: "Readiness Assessor",
    description:
      "Calcula preparación por dimensión, bloqueadores y siguientes acciones con evidencia explícita.",
    promptVersion: "readiness.v2",
    requiresProjectModel: true,
    requiresArtifacts: true,
  },
];

export function getAgentDefinition(
  key: AgentKey
): AgentDefinition {
  const definition = agentCatalog.find(
    (agent) => agent.key === key
  );

  if (!definition) {
    throw new Error(
      `No existe una definición registrada para el agente "${key}".`
    );
  }

  return definition;
}
