import {
  artifactTypes,
} from "../../domain/artifacts/artifact-catalog.ts";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { ConsistencyCategory, ConsistencySeverity } from "@/domain/consistency/consistency";
import type { ProjectModel } from "@/domain/project-model/project-model";
import {
  clampReadinessScore,
  getReadinessLevel,
  readinessDimensions,
  type ReadinessActionDraft,
  type ReadinessAssessmentDraft,
  type ReadinessBlockerDraft,
  type ReadinessDimension,
  type ReadinessDimensionDraft,
  type ReadinessPriority,
} from "../../domain/readiness/readiness.ts";

import {
  createReadinessFingerprint,
  normalizeReadinessText,
} from "./readiness-fingerprint.ts";

export type ReadinessArtifactInput = {
  type: ArtifactType;
  content: string;
};

export type ReadinessArtifactStateInput = {
  artifactType: ArtifactType;
  status: "current" | "outdated" | "regenerating" | "failed";
  basedOnModelVersion: number | null;
  reason: string | null;
};

export type ReadinessConsistencyFindingInput = {
  severity: ConsistencySeverity;
  category: ConsistencyCategory;
  status: "open" | "accepted" | "dismissed" | "resolved";
  title: string;
};

type GenerateDeterministicReadinessInput = {
  projectModel: ProjectModel;
  modelVersionNumber: number | null;
  artifacts: ReadinessArtifactInput[];
  artifactStates: ReadinessArtifactStateInput[];
  consistencyFindings: ReadinessConsistencyFindingInput[];
  interview: {
    status: string | null;
    answeredCount: number;
    totalQuestions: number;
  };
};

type DimensionAccumulator = {
  key: ReadinessDimension;
  score: number;
  evidence: string[];
  gaps: string[];
};

const dimensionCategories: Record<
  ReadinessDimension,
  readonly ConsistencyCategory[]
> = {
  product: ["requirement_gap", "contradiction"],
  domain: ["domain_gap", "contradiction"],
  architecture: ["architecture_gap", "contradiction", "stale_artifact"],
  data: ["data_gap", "domain_gap", "stale_artifact"],
  security: ["security_gap", "contradiction", "stale_artifact"],
  testing: ["requirement_gap", "delivery_gap"],
  delivery: ["delivery_gap", "requirement_gap", "stale_artifact"],
  operations: ["delivery_gap", "architecture_gap", "security_gap"],
};

const artifactDimensionMap: Record<
  ArtifactType,
  readonly ReadinessDimension[]
> = {
  product_spec: ["product"],
  mvp_scope: ["product", "delivery"],
  domain_model: ["domain"],
  architecture: ["architecture", "operations"],
  data_model: ["data"],
  security: ["security", "operations"],
  backlog: ["delivery", "testing"],
  vertical_slice_plan: ["testing", "delivery", "operations"],
};

const priorityRank: Record<ReadinessPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function createAccumulator(
  key: ReadinessDimension
): DimensionAccumulator {
  return {
    key,
    score: 100,
    evidence: [],
    gaps: [],
  };
}

function deduct(
  accumulator: DimensionAccumulator,
  points: number,
  gap: string
): void {
  accumulator.score -= points;
  accumulator.gaps.push(gap);
}

function addEvidence(
  accumulator: DimensionAccumulator,
  evidence: string
): void {
  if (!accumulator.evidence.includes(evidence)) {
    accumulator.evidence.push(evidence);
  }
}

function containsTestingEvidence(content: string): boolean {
  const normalized = normalizeReadinessText(content);
  return [
    "test",
    "testing",
    "prueba",
    "criterio de aceptacion",
    "acceptance criteria",
    "validacion",
    "verification",
  ].some((term) => normalized.includes(normalizeReadinessText(term)));
}

function containsOperationsEvidence(content: string): boolean {
  const normalized = normalizeReadinessText(content);
  return [
    "observability",
    "monitoring",
    "monitoreo",
    "logging",
    "logs",
    "alert",
    "backup",
    "rollback",
    "incident",
    "deployment",
    "despliegue",
    "operacion",
  ].some((term) => normalized.includes(normalizeReadinessText(term)));
}

function severityDeduction(
  severity: ConsistencySeverity
): number {
  switch (severity) {
    case "critical":
      return 28;
    case "high":
      return 18;
    case "medium":
      return 9;
    case "low":
      return 4;
    case "info":
      return 1;
  }
}

function severityPriority(
  severity: ConsistencySeverity
): ReadinessPriority {
  if (severity === "critical") {
    return "critical";
  }

  if (severity === "high") {
    return "high";
  }

  if (severity === "medium") {
    return "medium";
  }

  return "low";
}

function makeBlocker(input: {
  dimension: ReadinessDimension;
  title: string;
  reason: string;
  priority: ReadinessPriority;
  evidence: string[];
}): ReadinessBlockerDraft {
  return {
    ...input,
    fingerprint: createReadinessFingerprint(
      input.dimension,
      input.title,
      input.reason
    ),
  };
}

function makeAction(input: {
  dimension: ReadinessDimension;
  action: string;
  ownerRole: string;
  expectedOutcome: string;
  priority: Exclude<ReadinessPriority, "critical">;
}): ReadinessActionDraft {
  return {
    ...input,
    fingerprint: createReadinessFingerprint(
      input.dimension,
      input.action,
      input.expectedOutcome
    ),
  };
}

function addBlocker(
  blockers: Map<string, ReadinessBlockerDraft>,
  blocker: ReadinessBlockerDraft
): void {
  const existing = blockers.get(blocker.fingerprint);

  if (
    !existing ||
    priorityRank[blocker.priority] > priorityRank[existing.priority]
  ) {
    blockers.set(blocker.fingerprint, blocker);
  }
}

function addAction(
  actions: Map<string, ReadinessActionDraft>,
  action: ReadinessActionDraft
): void {
  actions.set(action.fingerprint, action);
}

function buildRationale(
  dimension: DimensionAccumulator
): string {
  const score = clampReadinessScore(dimension.score);

  if (score >= 90) {
    return "La evidencia disponible es coherente y no presenta brechas significativas en esta dimensión.";
  }

  if (score >= 75) {
    return "La dimensión tiene una base utilizable, aunque todavía existen brechas que requieren revisión antes de declarar preparación completa.";
  }

  if (score >= 60) {
    return "La dimensión está en progreso, pero conserva dependencias o decisiones importantes sin resolver.";
  }

  if (score >= 40) {
    return "La evidencia es insuficiente o presenta riesgos relevantes que comprometen la preparación de esta dimensión.";
  }

  return "La dimensión no tiene todavía una base mínima confiable para iniciar implementación sin un riesgo elevado de retrabajo.";
}

function buildDimension(
  accumulator: DimensionAccumulator
): ReadinessDimensionDraft {
  const score = clampReadinessScore(accumulator.score);

  return {
    key: accumulator.key,
    score,
    rationale: buildRationale(accumulator),
    evidence: accumulator.evidence.slice(0, 12),
    gaps: accumulator.gaps.slice(0, 12),
  };
}

export function generateDeterministicReadinessAssessment(
  input: GenerateDeterministicReadinessInput
): ReadinessAssessmentDraft {
  const accumulators = new Map(
    readinessDimensions.map((dimension) => [
      dimension,
      createAccumulator(dimension),
    ])
  );

  const blockers = new Map<string, ReadinessBlockerDraft>();
  const actions = new Map<string, ReadinessActionDraft>();
  const artifacts = new Map(
    input.artifacts.map((artifact) => [artifact.type, artifact])
  );
  const artifactStates = new Map(
    input.artifactStates.map((state) => [state.artifactType, state])
  );

  const mustRequirements = input.projectModel.requirements.filter(
    (requirement) => requirement.priority === "must"
  );
  const confirmedMustRequirements = mustRequirements.filter(
    (requirement) => requirement.status === "confirmed"
  );
  const unresolvedHighQuestions = input.projectModel.openQuestions.filter(
    (question) => question.priority === "high"
  );
  const unresolvedHighAssumptions = input.projectModel.assumptions.filter(
    (assumption) =>
      assumption.impact === "high" &&
      assumption.status !== "confirmed"
  );
  const unresolvedEntities = input.projectModel.domainEntities.filter(
    (entity) =>
      entity.status !== "confirmed" &&
      entity.status !== "rejected"
  );
  const highRisks = input.projectModel.risks.filter(
    (risk) => risk.impact === "high" || risk.probability === "high"
  );
  const unmitigatedHighRisks = highRisks.filter(
    (risk) => risk.mitigation.trim().length < 20
  );
  const operationalRequirements = input.projectModel.requirements.filter(
    (requirement) => requirement.type === "operational"
  );

  const product = accumulators.get("product")!;
  const domain = accumulators.get("domain")!;
  const architecture = accumulators.get("architecture")!;
  const data = accumulators.get("data")!;
  const security = accumulators.get("security")!;
  const testing = accumulators.get("testing")!;
  const delivery = accumulators.get("delivery")!;
  const operations = accumulators.get("operations")!;

  if (input.interview.totalQuestions > 0) {
    const completion = Math.round(
      (input.interview.answeredCount / input.interview.totalQuestions) * 100
    );
    addEvidence(product, `Entrevista base completada al ${completion}%.`);

    if (completion < 100) {
      deduct(product, completion < 50 ? 25 : 12, "La entrevista base todavía no está completa.");
    }
  } else {
    deduct(product, 20, "No existe una definición de preguntas base para medir el descubrimiento.");
  }

  if (input.projectModel.status === "approved") {
    addEvidence(product, "El Project Model está aprobado.");
    addEvidence(domain, "El Project Model está aprobado.");
  } else {
    deduct(product, 15, `El Project Model está en estado ${input.projectModel.status}.`);
    deduct(domain, 10, `El Project Model está en estado ${input.projectModel.status}.`);
  }

  if (mustRequirements.length === 0) {
    deduct(product, 35, "No existen requisitos Must definidos.");
    addBlocker(blockers, makeBlocker({
      dimension: "product",
      title: "No existen requisitos obligatorios",
      reason: "El alcance no tiene requisitos Must que permitan definir qué debe entregar el producto.",
      priority: "critical",
      evidence: ["Project Model sin requisitos de prioridad must."],
    }));
    addAction(actions, makeAction({
      dimension: "product",
      action: "Definir y confirmar los requisitos Must del producto.",
      ownerRole: "Product Owner",
      expectedOutcome: "Alcance mínimo verificable y trazable para implementación.",
      priority: "high",
    }));
  } else {
    addEvidence(
      product,
      `${confirmedMustRequirements.length} de ${mustRequirements.length} requisitos Must están confirmados.`
    );

    const confirmationRatio =
      confirmedMustRequirements.length / mustRequirements.length;

    if (confirmationRatio < 1) {
      deduct(product, Math.ceil((1 - confirmationRatio) * 35), "Existen requisitos Must sin confirmar.");
      addBlocker(blockers, makeBlocker({
        dimension: "product",
        title: "Requisitos Must sin confirmar",
        reason: "Los requisitos obligatorios no están completamente validados con evidencia humana.",
        priority: confirmationRatio < 0.5 ? "critical" : "high",
        evidence: mustRequirements
          .filter((requirement) => requirement.status !== "confirmed")
          .map((requirement) => `${requirement.id}: ${requirement.title} (${requirement.status})`)
          .slice(0, 8),
      }));
    }
  }

  if (unresolvedHighQuestions.length > 0) {
    deduct(product, Math.min(24, unresolvedHighQuestions.length * 8), "Persisten preguntas abiertas de alta prioridad.");
    deduct(delivery, Math.min(15, unresolvedHighQuestions.length * 5), "Preguntas de alta prioridad pueden alterar el plan de entrega.");
    addBlocker(blockers, makeBlocker({
      dimension: "product",
      title: "Preguntas críticas sin resolver",
      reason: "Hay decisiones de alta prioridad que todavía pueden modificar alcance, arquitectura o entrega.",
      priority: "high",
      evidence: unresolvedHighQuestions.map((question) => question.question).slice(0, 8),
    }));
  }

  if (input.projectModel.domainEntities.length === 0) {
    deduct(domain, 35, "No existen entidades de dominio definidas.");
    deduct(data, 20, "No existe una base de entidades para diseñar persistencia.");
  } else {
    const confirmedEntities = input.projectModel.domainEntities.filter(
      (entity) => entity.status === "confirmed"
    );
    addEvidence(domain, `${confirmedEntities.length} de ${input.projectModel.domainEntities.length} entidades están confirmadas.`);

    if (unresolvedEntities.length > 0) {
      deduct(domain, Math.min(30, unresolvedEntities.length * 7), "Existen entidades de dominio sin confirmar.");
      deduct(data, Math.min(18, unresolvedEntities.length * 4), "Entidades no resueltas afectan el Data Model.");
    }
  }

  if (unresolvedHighAssumptions.length > 0) {
    deduct(product, Math.min(20, unresolvedHighAssumptions.length * 7), "Supuestos de alto impacto siguen sin confirmar.");
    deduct(architecture, Math.min(16, unresolvedHighAssumptions.length * 5), "Supuestos de alto impacto afectan decisiones arquitectónicas.");
    addBlocker(blockers, makeBlocker({
      dimension: "architecture",
      title: "Supuestos de alto impacto sin confirmar",
      reason: "La arquitectura podría consolidarse sobre premisas que todavía no han sido validadas.",
      priority: "high",
      evidence: unresolvedHighAssumptions.map((assumption) => assumption.statement).slice(0, 8),
    }));
  }

  for (const artifactType of artifactTypes) {
    const artifact = artifacts.get(artifactType);
    const impactedDimensions = artifactDimensionMap[artifactType];

    if (!artifact) {
      for (const dimension of impactedDimensions) {
        deduct(accumulators.get(dimension)!, 18, `Falta el documento ${artifactType}.`);
      }
      continue;
    }

    for (const dimension of impactedDimensions) {
      addEvidence(accumulators.get(dimension)!, `Existe el artefacto ${artifactType}.`);
    }

    const state = artifactStates.get(artifactType);
    if (state && state.status !== "current") {
      const points = state.status === "failed" ? 20 : 12;
      for (const dimension of impactedDimensions) {
        deduct(accumulators.get(dimension)!, points, `${artifactType} está ${state.status}.`);
      }
    }
  }

  const testingArtifacts = [
    artifacts.get("mvp_scope"),
    artifacts.get("backlog"),
    artifacts.get("vertical_slice_plan"),
  ].filter((artifact): artifact is ReadinessArtifactInput => Boolean(artifact));

  const artifactsWithTestingEvidence = testingArtifacts.filter(
    (artifact) => containsTestingEvidence(artifact.content)
  );

  if (artifactsWithTestingEvidence.length === 0) {
    deduct(testing, 45, "No se encontró evidencia explícita de criterios de aceptación, pruebas o verificación.");
    addBlocker(blockers, makeBlocker({
      dimension: "testing",
      title: "Estrategia de verificación insuficiente",
      reason: "El paquete técnico no evidencia cómo se comprobará que el producto cumple sus requisitos.",
      priority: "high",
      evidence: ["MVP Scope, Backlog y Vertical Slice sin referencias suficientes a pruebas o criterios de aceptación."],
    }));
    addAction(actions, makeAction({
      dimension: "testing",
      action: "Definir criterios de aceptación y estrategia de pruebas para el vertical slice.",
      ownerRole: "Tech Lead / QA",
      expectedOutcome: "Ruta de entrega verificable con criterios objetivos de éxito.",
      priority: "high",
    }));
  } else {
    addEvidence(testing, `${artifactsWithTestingEvidence.length} artefactos contienen evidencia de pruebas o verificación.`);
  }

  const operationalArtifacts = [
    artifacts.get("architecture"),
    artifacts.get("security"),
    artifacts.get("vertical_slice_plan"),
  ].filter((artifact): artifact is ReadinessArtifactInput => Boolean(artifact));

  const artifactsWithOperationsEvidence = operationalArtifacts.filter(
    (artifact) => containsOperationsEvidence(artifact.content)
  );

  if (operationalRequirements.length === 0) {
    deduct(operations, 18, "No existen requisitos operacionales explícitos.");
  } else {
    addEvidence(operations, `${operationalRequirements.length} requisitos operacionales definidos.`);
  }

  if (artifactsWithOperationsEvidence.length === 0) {
    deduct(operations, 35, "No se encontró evidencia de despliegue, monitoreo, rollback, backups o respuesta a incidentes.");
    addBlocker(blockers, makeBlocker({
      dimension: "operations",
      title: "Preparación operativa no definida",
      reason: "No existe evidencia suficiente de cómo desplegar, observar, recuperar y operar la solución.",
      priority: "high",
      evidence: ["Architecture, Security y Vertical Slice sin señales operativas suficientes."],
    }));
  } else {
    addEvidence(operations, `${artifactsWithOperationsEvidence.length} artefactos contienen evidencia operativa.`);
  }

  if (unmitigatedHighRisks.length > 0) {
    deduct(security, Math.min(35, unmitigatedHighRisks.length * 12), "Existen riesgos altos sin mitigación suficiente.");
    deduct(architecture, Math.min(20, unmitigatedHighRisks.length * 7), "Riesgos altos afectan decisiones arquitectónicas.");
    addBlocker(blockers, makeBlocker({
      dimension: "security",
      title: "Riesgos altos sin mitigación suficiente",
      reason: "Uno o más riesgos de alta probabilidad o impacto no tienen una respuesta concreta y verificable.",
      priority: "critical",
      evidence: unmitigatedHighRisks.map((risk) => `${risk.title}: ${risk.mitigation || "sin mitigación"}`).slice(0, 8),
    }));
  } else if (highRisks.length > 0) {
    addEvidence(security, `${highRisks.length} riesgos altos tienen mitigaciones documentadas.`);
  }

  for (const finding of input.consistencyFindings) {
    if (finding.status === "resolved" || finding.status === "dismissed") {
      continue;
    }

    const impactedDimensions = readinessDimensions.filter((dimension) =>
      dimensionCategories[dimension].includes(finding.category)
    );
    const points = severityDeduction(finding.severity);

    for (const dimension of impactedDimensions) {
      deduct(
        accumulators.get(dimension)!,
        points,
        `Hallazgo ${finding.severity}: ${finding.title}`
      );
    }

    if (finding.severity === "critical" || finding.severity === "high") {
      for (const dimension of impactedDimensions.slice(0, 1)) {
        addBlocker(blockers, makeBlocker({
          dimension,
          title: finding.title,
          reason: "Hallazgo de consistencia abierto que compromete la preparación del proyecto.",
          priority: severityPriority(finding.severity),
          evidence: [`Categoría: ${finding.category}`, `Estado: ${finding.status}`],
        }));
      }
    }
  }

  const dimensions = readinessDimensions.map((dimension) =>
    buildDimension(accumulators.get(dimension)!)
  );

  let overallScore = Math.round(
    dimensions.reduce((total, dimension) => total + dimension.score, 0) /
      dimensions.length
  );

  const blockerValues = [...blockers.values()];
  if (blockerValues.some((blocker) => blocker.priority === "critical")) {
    overallScore = Math.min(overallScore, 49);
  } else if (blockerValues.some((blocker) => blocker.priority === "high")) {
    overallScore = Math.min(overallScore, 69);
  }

  const sortedBlockers = blockerValues.sort(
    (left, right) =>
      priorityRank[right.priority] - priorityRank[left.priority]
  );

  for (const dimension of dimensions) {
    if (dimension.score < 75 && dimension.gaps.length > 0) {
      addAction(actions, makeAction({
        dimension: dimension.key,
        action: `Resolver la brecha principal de ${dimension.key}: ${dimension.gaps[0]}`,
        ownerRole: dimension.key === "product" ? "Product Owner" : "Tech Lead",
        expectedOutcome: `Elevar la evidencia y reducir los bloqueadores de la dimensión ${dimension.key}.`,
        priority: dimension.score < 50 ? "high" : "medium",
      }));
    }
  }

  return {
    source: "deterministic",
    summary:
      sortedBlockers.length === 0
        ? "El proyecto no presenta bloqueadores deterministas críticos, pero debe mantenerse bajo revisión antes de iniciar implementación."
        : `El análisis determinista detectó ${sortedBlockers.length} bloqueadores o dependencias que requieren atención antes de declarar el proyecto listo.`,
    overallScore: clampReadinessScore(overallScore),
    level: getReadinessLevel(overallScore),
    confidence: null,
    dimensions,
    blockers: sortedBlockers.slice(0, 24),
    nextActions: [...actions.values()]
      .sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority])
      .slice(0, 24),
    evidenceSnapshot: {
      engineVersion: "deterministic.v1",
      modelVersionNumber: input.modelVersionNumber,
      modelUpdatedAt: input.projectModel.updatedAt,
      interview: input.interview,
      artifactTypes: input.artifacts.map((artifact) => artifact.type),
      artifactStates: input.artifactStates,
      consistencyFindingCount: input.consistencyFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}
