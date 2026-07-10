import type { FoundationProject } from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderEmptyState(message: string): string {
  return `> ${message}`;
}

function renderRequirements(model: ProjectModel): string {
  if (model.requirements.length === 0) {
    return renderEmptyState(
      "No hay requisitos detectados todavía."
    );
  }

  return model.requirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

- **Tipo:** ${requirement.type}
- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

${requirement.description}`
    )
    .join("\n\n");
}

function renderDomainEntities(model: ProjectModel): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades de dominio detectadas todavía."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. ${entity.name}

- **Estado:** ${entity.status}
- **Fuente:** ${entity.sourceQuestionId ?? "No especificada"}

${entity.description}`
    )
    .join("\n\n");
}

function renderAssumptions(model: ProjectModel): string {
  if (model.assumptions.length === 0) {
    return renderEmptyState(
      "No hay supuestos detectados todavía."
    );
  }

  return model.assumptions
    .map(
      (assumption, index) => `### ${index + 1}. Supuesto

- **Impacto:** ${assumption.impact}
- **Estado:** ${assumption.status}
- **Fuente:** ${assumption.sourceQuestionId ?? "No especificada"}

${assumption.statement}`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos detectados todavía."
    );
  }

  return model.risks
    .map(
      (risk, index) => `### ${index + 1}. ${risk.title}

- **Probabilidad:** ${risk.probability}
- **Impacto:** ${risk.impact}

${risk.description}

**Mitigación propuesta:** ${risk.mitigation}`
    )
    .join("\n\n");
}

function renderOpenQuestions(model: ProjectModel): string {
  if (model.openQuestions.length === 0) {
    return renderEmptyState(
      "No hay preguntas abiertas críticas."
    );
  }

  return model.openQuestions
    .map(
      (item, index) => `### ${index + 1}. ${item.question}

- **Prioridad:** ${item.priority}
- **Razón:** ${item.reason}`
    )
    .join("\n\n");
}

export function generateProductSpecMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Product Spec — ${project.name}

## 1. Estado del documento

- **Tipo:** Product Specification
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este documento fue generado desde el Project Model inicial. Debe ser revisado y aprobado antes de usarse como especificación final de desarrollo.

---

## 2. Resumen del producto

${project.description || "No hay descripción inicial disponible."}

---

## 3. Industria

${project.industry || "No definida."}

---

## 4. Tipo de producto

${project.productType}

---

## 5. Objetivo principal

${project.mainGoal || "No definido."}

---

## 6. Nivel técnico del usuario solicitante

${project.technicalLevel}

---

## 7. Requisitos detectados

${renderRequirements(model)}

---

## 8. Entidades principales del dominio

${renderDomainEntities(model)}

---

## 9. Supuestos

${renderAssumptions(model)}

---

## 10. Riesgos iniciales

${renderRisks(model)}

---

## 11. Preguntas abiertas

${renderOpenQuestions(model)}

---

## 12. Próximos pasos recomendados

1. Revisar requisitos detectados.
2. Confirmar o rechazar supuestos.
3. Completar preguntas abiertas.
4. Refinar entidades del dominio.
5. Generar MVP Scope.
6. Generar arquitectura inicial.
7. Generar backlog técnico.

---

## 13. Nota de trazabilidad

Cada requisito, supuesto o entidad debe conservar referencia a su fuente original. La fuente principal es la pregunta de entrevista asociada y debe persistirse como trazabilidad formal en la base de datos.
`;
}
