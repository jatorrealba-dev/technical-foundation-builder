import {
  artifactCatalog,
  type ArtifactCatalogItem,
} from "../../domain/artifacts/artifact-catalog.ts";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type {
  ConsistencyFindingDraft,
  ConsistencySeverity,
} from "@/domain/consistency/consistency";
import type { ProjectModel } from "@/domain/project-model/project-model";

import {
  contentIncludesReference,
  createConsistencyFingerprint,
} from "./consistency-fingerprint.ts";

export type ConsistencyArtifactInput = {
  type: ArtifactType;
  content: string;
};

export type ConsistencyArtifactStateInput = {
  artifactType: ArtifactType;
  status: "current" | "outdated" | "regenerating" | "failed";
  basedOnModelVersion: number | null;
  reason: string | null;
};

type GenerateDeterministicConsistencyFindingsInput = {
  projectModel: ProjectModel;
  artifacts: ConsistencyArtifactInput[];
  artifactStates: ConsistencyArtifactStateInput[];
};

function makeFinding(input: Omit<
  ConsistencyFindingDraft,
  "fingerprint" | "source"
>): ConsistencyFindingDraft {
  return {
    ...input,
    source: "deterministic",
    fingerprint: createConsistencyFingerprint(
      input.ruleKey,
      input.category,
      input.affectedArtifactTypes
    ),
  };
}

function getArtifactTitle(
  type: ArtifactType
): string {
  return artifactCatalog.find(
    (artifact) => artifact.type === type
  )?.title ?? type;
}

function missingReferenceSeverity(
  type: ArtifactType
): ConsistencySeverity {
  return type === "backlog" ||
    type === "vertical_slice_plan" ||
    type === "data_model"
    ? "high"
    : "medium";
}

function artifactByType(
  artifacts: readonly ConsistencyArtifactInput[]
): Map<ArtifactType, ConsistencyArtifactInput> {
  return new Map(
    artifacts.map((artifact) => [artifact.type, artifact])
  );
}

function artifactStateByType(
  states: readonly ConsistencyArtifactStateInput[]
): Map<ArtifactType, ConsistencyArtifactStateInput> {
  return new Map(
    states.map((state) => [state.artifactType, state])
  );
}

function addMissingArtifactFinding(
  findings: ConsistencyFindingDraft[],
  artifact: ArtifactCatalogItem
): void {
  findings.push(
    makeFinding({
      ruleKey: `artifact_missing:${artifact.type}`,
      severity: "medium",
      category: "delivery_gap",
      title: `${artifact.title} no ha sido generado`,
      description:
        `El paquete técnico no contiene ${artifact.filename}.`,
      evidence: [
        `No existe un artefacto vigente de tipo ${artifact.type}.`,
      ],
      affectedArtifactTypes: [artifact.type],
      recommendation:
        `Genera ${artifact.filename} desde la versión vigente del Project Model.`,
    })
  );
}

export function generateDeterministicConsistencyFindings(
  input: GenerateDeterministicConsistencyFindingsInput
): ConsistencyFindingDraft[] {
  const findings: ConsistencyFindingDraft[] = [];
  const artifacts = artifactByType(input.artifacts);
  const states = artifactStateByType(input.artifactStates);

  for (const definition of artifactCatalog) {
    const artifact = artifacts.get(definition.type);

    if (!artifact) {
      addMissingArtifactFinding(findings, definition);
      continue;
    }

    const state = states.get(definition.type);

    if (state && state.status !== "current") {
      findings.push(
        makeFinding({
          ruleKey: `artifact_state:${definition.type}:${state.status}`,
          severity:
            state.status === "failed" ? "high" : "medium",
          category: "stale_artifact",
          title: `${definition.title} está ${state.status}`,
          description:
            `El estado de vigencia de ${definition.filename} es ${state.status}.`,
          evidence: [
            state.reason ??
              "La tabla de vigencia documental reporta un estado distinto de current.",
            state.basedOnModelVersion
              ? `Basado en la versión ${state.basedOnModelVersion} del Project Model.`
              : "No se registró una versión base del Project Model.",
          ],
          affectedArtifactTypes: [definition.type],
          recommendation:
            `Regenera ${definition.filename} desde el Project Model vigente y confirma que el estado vuelva a current.`,
        })
      );
    }
  }

  const requirementArtifacts: ArtifactType[] = [
    "product_spec",
    "mvp_scope",
    "backlog",
    "vertical_slice_plan",
  ];

  for (const requirement of input.projectModel.requirements) {
    if (
      requirement.priority === "must" &&
      requirement.status !== "confirmed"
    ) {
      findings.push(
        makeFinding({
          ruleKey: `must_requirement_unconfirmed:${requirement.id}`,
          severity: "high",
          category: "requirement_gap",
          title: `Requisito Must sin confirmar: ${requirement.title}`,
          description:
            "Un requisito obligatorio permanece como supuesto, propuesta, no resuelto o rechazado.",
          evidence: [
            `Requisito ${requirement.id}: estado ${requirement.status}.`,
          ],
          affectedArtifactTypes: requirementArtifacts,
          recommendation:
            "Confirma el requisito con evidencia, cambia su prioridad o documenta explícitamente por qué no formará parte del alcance.",
        })
      );
    }

    if (requirement.priority !== "must") {
      continue;
    }

    for (const artifactType of requirementArtifacts) {
      const artifact = artifacts.get(artifactType);

      if (
        !artifact ||
        contentIncludesReference({
          content: artifact.content,
          id: requirement.id,
          label: requirement.title,
        })
      ) {
        continue;
      }

      findings.push(
        makeFinding({
          ruleKey: `must_requirement_missing:${requirement.id}:${artifactType}`,
          severity: missingReferenceSeverity(artifactType),
          category:
            artifactType === "backlog" ||
            artifactType === "vertical_slice_plan"
              ? "delivery_gap"
              : "requirement_gap",
          title: `Requisito Must ausente en ${getArtifactTitle(artifactType)}`,
          description:
            `El requisito "${requirement.title}" no aparece de forma trazable en el documento.`,
          evidence: [
            `Requisito ${requirement.id} con prioridad must.`,
            `No se encontró el identificador ni el título en ${getArtifactTitle(artifactType)}.`,
          ],
          affectedArtifactTypes: [artifactType],
          recommendation:
            `Regenera o corrige ${getArtifactTitle(artifactType)} para incluir el requisito y su trazabilidad.`,
        })
      );
    }
  }

  const entityArtifacts: ArtifactType[] = [
    "domain_model",
    "data_model",
  ];

  for (const entity of input.projectModel.domainEntities) {
    if (
      entity.status === "unresolved" ||
      entity.status === "rejected"
    ) {
      findings.push(
        makeFinding({
          ruleKey: `domain_entity_unresolved:${entity.id}`,
          severity: "medium",
          category: "domain_gap",
          title: `Entidad de dominio sin resolver: ${entity.name}`,
          description:
            "Una entidad candidata todavía no tiene una decisión de dominio utilizable.",
          evidence: [
            `Entidad ${entity.id}: estado ${entity.status}.`,
          ],
          affectedArtifactTypes: entityArtifacts,
          recommendation:
            "Confirma, redefine o elimina la entidad antes de consolidar el modelo de dominio y datos.",
        })
      );
    }

    for (const artifactType of entityArtifacts) {
      const artifact = artifacts.get(artifactType);

      if (
        !artifact ||
        contentIncludesReference({
          content: artifact.content,
          id: entity.id,
          label: entity.name,
        })
      ) {
        continue;
      }

      findings.push(
        makeFinding({
          ruleKey: `entity_missing:${entity.id}:${artifactType}`,
          severity:
            artifactType === "data_model" ? "high" : "medium",
          category:
            artifactType === "data_model"
              ? "data_gap"
              : "domain_gap",
          title: `Entidad ${entity.name} ausente en ${getArtifactTitle(artifactType)}`,
          description:
            "La entidad existe en el Project Model, pero no aparece en el documento relacionado.",
          evidence: [
            `Entidad ${entity.id}: ${entity.name}.`,
            `No se encontró el identificador ni el nombre en ${getArtifactTitle(artifactType)}.`,
          ],
          affectedArtifactTypes: [artifactType],
          recommendation:
            `Regenera o corrige ${getArtifactTitle(artifactType)} para reflejar la entidad y sus responsabilidades.`,
        })
      );
    }
  }

  for (const assumption of input.projectModel.assumptions) {
    if (
      assumption.impact === "high" &&
      assumption.status !== "confirmed"
    ) {
      findings.push(
        makeFinding({
          ruleKey: `high_impact_assumption:${assumption.id}`,
          severity: "high",
          category: "contradiction",
          title: "Supuesto de alto impacto sin confirmar",
          description: assumption.statement,
          evidence: [
            `Supuesto ${assumption.id}: impacto high, estado ${assumption.status}.`,
          ],
          affectedArtifactTypes: [
            "product_spec",
            "architecture",
            "security",
            "vertical_slice_plan",
          ],
          recommendation:
            "Valida el supuesto con un responsable o conviértelo en una pregunta abierta con fecha de resolución.",
        })
      );
    }
  }

  for (const question of input.projectModel.openQuestions) {
    if (question.priority !== "high") {
      continue;
    }

    findings.push(
      makeFinding({
        ruleKey: `high_priority_open_question:${question.id}`,
        severity: "high",
        category: "requirement_gap",
        title: "Pregunta abierta de alta prioridad",
        description: question.question,
        evidence: [
          `Pregunta ${question.id}: ${question.reason}`,
        ],
        affectedArtifactTypes: [
          "product_spec",
          "architecture",
          "security",
          "vertical_slice_plan",
        ],
        recommendation:
          "Asigna un responsable y resuelve la pregunta antes de considerar el proyecto listo para implementación.",
      })
    );
  }

  const riskArtifacts: ArtifactType[] = [
    "architecture",
    "security",
  ];

  for (const risk of input.projectModel.risks) {
    const missingMitigation =
      risk.mitigation.trim().length < 12;

    if (missingMitigation) {
      findings.push(
        makeFinding({
          ruleKey: `risk_missing_mitigation:${risk.id}`,
          severity:
            risk.impact === "high" ? "critical" : "high",
          category: "security_gap",
          title: `Riesgo sin mitigación suficiente: ${risk.title}`,
          description: risk.description,
          evidence: [
            `Riesgo ${risk.id}: impacto ${risk.impact}, probabilidad ${risk.probability}.`,
            "La mitigación está vacía o es demasiado breve para ser verificable.",
          ],
          affectedArtifactTypes: riskArtifacts,
          recommendation:
            "Define una mitigación concreta, un responsable y una forma verificable de comprobar el control.",
        })
      );
    }

    if (risk.impact !== "high" && risk.probability !== "high") {
      continue;
    }

    for (const artifactType of riskArtifacts) {
      const artifact = artifacts.get(artifactType);

      if (
        !artifact ||
        contentIncludesReference({
          content: artifact.content,
          id: risk.id,
          label: risk.title,
        })
      ) {
        continue;
      }

      findings.push(
        makeFinding({
          ruleKey: `high_risk_missing:${risk.id}:${artifactType}`,
          severity: "high",
          category:
            artifactType === "security"
              ? "security_gap"
              : "architecture_gap",
          title: `Riesgo alto ausente en ${getArtifactTitle(artifactType)}`,
          description:
            `El riesgo "${risk.title}" no aparece de forma trazable en el documento.`,
          evidence: [
            `Riesgo ${risk.id}: impacto ${risk.impact}, probabilidad ${risk.probability}.`,
          ],
          affectedArtifactTypes: [artifactType],
          recommendation:
            `Incluye el riesgo, su mitigación y el método de verificación en ${getArtifactTitle(artifactType)}.`,
        })
      );
    }
  }

  return findings.sort((left, right) => {
    const weight: Record<ConsistencySeverity, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };

    return weight[right.severity] - weight[left.severity];
  });
}
