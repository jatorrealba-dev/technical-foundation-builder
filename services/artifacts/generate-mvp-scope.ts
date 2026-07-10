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

function renderIncludedRequirements(
  model: ProjectModel
): string {
  const includedRequirements =
    model.requirements.filter(
      (requirement) =>
        requirement.priority === "must"
    );

  if (includedRequirements.length === 0) {
    return renderEmptyState(
      "No se han identificado requisitos obligatorios para el MVP."
    );
  }

  return includedRequirements
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

function renderDeferredRequirements(
  model: ProjectModel
): string {
  const deferredRequirements =
    model.requirements.filter(
      (requirement) =>
        requirement.priority !== "must"
    );

  if (deferredRequirements.length === 0) {
    return renderEmptyState(
      "Todavía no se han identificado capacidades explícitas para fases posteriores."
    );
  }

  return deferredRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

- **Prioridad actual:** ${requirement.priority}
- **Tipo:** ${requirement.type}
- **Estado:** ${requirement.status}

${requirement.description}`
    )
    .join("\n\n");
}

function renderDomainEntities(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades de dominio identificadas todavía."
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

function renderAcceptanceCriteria(
  model: ProjectModel
): string {
  const includedRequirements =
    model.requirements.filter(
      (requirement) =>
        requirement.priority === "must"
    );

  if (includedRequirements.length === 0) {
    return renderEmptyState(
      "Los criterios de aceptación deberán definirse cuando existan requisitos obligatorios confirmados."
    );
  }

  return includedRequirements
    .map(
      (requirement, index) => `${index + 1}. **${requirement.title}**
   - La capacidad descrita debe estar disponible en la versión desplegable del MVP.
   - Debe existir una validación funcional verificable.
   - El resultado debe corresponder con esta definición: ${requirement.description}
   - Debe conservarse trazabilidad con la fuente \`${requirement.sourceQuestionId ?? "no-especificada"}\`.`
    )
    .join("\n\n");
}

function renderAssumptions(
  model: ProjectModel
): string {
  if (model.assumptions.length === 0) {
    return renderEmptyState(
      "No hay supuestos registrados actualmente."
    );
  }

  return model.assumptions
    .map(
      (assumption, index) => `### ${index + 1}. ${assumption.statement}

- **Impacto:** ${assumption.impact}
- **Estado:** ${assumption.status}
- **Fuente:** ${assumption.sourceQuestionId ?? "No especificada"}`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos iniciales registrados."
    );
  }

  return model.risks
    .map(
      (risk, index) => `### ${index + 1}. ${risk.title}

- **Probabilidad:** ${risk.probability}
- **Impacto:** ${risk.impact}

${risk.description}

**Mitigación requerida para el MVP:** ${risk.mitigation}`
    )
    .join("\n\n");
}

function renderOpenQuestions(
  model: ProjectModel
): string {
  if (model.openQuestions.length === 0) {
    return renderEmptyState(
      "No hay preguntas abiertas críticas para la definición actual."
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

export function generateMvpScopeMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# MVP Scope — ${project.name}

## 1. Estado del documento

- **Tipo:** Minimum Viable Product Scope
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este documento delimita una primera versión útil del producto. Debe ser revisado antes de convertirse en compromiso de entrega.

---

## 2. Propósito del MVP

${project.mainGoal || "El objetivo principal del MVP todavía no ha sido definido."}

---

## 3. Resumen del producto

${project.description || "No hay una descripción inicial disponible."}

---

## 4. Contexto de implementación

- **Industria:** ${project.industry || "No definida"}
- **Tipo de producto:** ${project.productType}
- **Nivel técnico del solicitante:** ${project.technicalLevel}

---

## 5. Resultado mínimo esperado

El MVP deberá entregar una versión utilizable que permita validar el objetivo principal del proyecto sin incorporar capacidades que no sean indispensables para demostrar valor.

La primera versión se considerará útil cuando:

1. Las capacidades obligatorias estén implementadas y verificadas.
2. Los flujos principales puedan ejecutarse de principio a fin.
3. Los datos esenciales puedan crearse, consultarse y protegerse.
4. Los riesgos de impacto alto tengan una mitigación inicial.
5. Exista una versión desplegable y susceptible de validación por usuarios reales.

---

## 6. Alcance incluido

${renderIncludedRequirements(model)}

---

## 7. Alcance diferido

${renderDeferredRequirements(model)}

> Todo elemento no incluido expresamente en la sección de alcance incluido deberá considerarse fuera del MVP hasta ser evaluado y aprobado.

---

## 8. Entidades necesarias para el MVP

${renderDomainEntities(model)}

---

## 9. Criterios de aceptación iniciales

${renderAcceptanceCriteria(model)}

---

## 10. Supuestos de planificación

${renderAssumptions(model)}

---

## 11. Riesgos que pueden afectar el MVP

${renderRisks(model)}

---

## 12. Preguntas abiertas y bloqueadores

${renderOpenQuestions(model)}

---

## 13. Secuencia recomendada de entrega

1. Confirmar el alcance incluido y los criterios de aceptación.
2. Resolver las preguntas abiertas de prioridad alta.
3. Definir los flujos principales de usuario.
4. Refinar las entidades mínimas del dominio.
5. Implementar autenticación, autorización y aislamiento de datos cuando corresponda.
6. Construir una primera vertical slice funcional.
7. Validar el flujo completo con datos reales o representativos.
8. Corregir riesgos críticos antes del despliegue.
9. Publicar una versión inicial para validación controlada.
10. Recopilar resultados antes de ampliar el alcance.

---

## 14. Definición de terminado del MVP

El MVP se considerará terminado cuando:

- Los requisitos marcados como obligatorios estén implementados.
- Los criterios de aceptación definidos puedan comprobarse.
- No existan defectos críticos que impidan completar el flujo principal.
- Los datos sensibles tengan controles de acceso apropiados.
- La versión pueda desplegarse de forma repetible.
- Exista una estrategia mínima de pruebas.
- Los supuestos de impacto alto hayan sido confirmados o documentados.
- Los riesgos de impacto alto tengan una mitigación aceptada.
- Las decisiones y elementos pendientes estén documentados.
- Un responsable del producto pueda aceptar formalmente la entrega.

---

## 15. Control de cambios de alcance

Toda ampliación posterior deberá indicar:

1. La necesidad o problema que resuelve.
2. El requisito relacionado.
3. El impacto en tiempo, arquitectura, seguridad y pruebas.
4. Si sustituye o modifica una capacidad ya incluida.
5. La fase propuesta para su implementación.

---

## 16. Nota de trazabilidad

El alcance fue derivado del Project Model y de las respuestas de entrevista asociadas. Cada capacidad debe mantener referencia a su requisito y fuente original para evitar ampliaciones no justificadas.
`;
}
