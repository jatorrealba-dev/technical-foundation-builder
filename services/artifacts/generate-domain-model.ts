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

function escapeTableCell(value: string): string {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function renderUbiquitousLanguage(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "Todavía no existe vocabulario de dominio suficiente para construir un glosario."
    );
  }

  const rows = model.domainEntities
    .map(
      (entity) =>
        `| ${escapeTableCell(entity.name)} | ${escapeTableCell(
          entity.description
        )} | ${entity.status} | ${
          entity.sourceQuestionId ?? "No especificada"
        } |`
    )
    .join("\n");

  return `| Término | Definición inicial | Estado | Fuente |
|---|---|---|---|
${rows}`;
}

function renderEntityCatalog(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No se han identificado entidades de dominio."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. ${entity.name}

- **ID del modelo:** \`${entity.id}\`
- **Estado:** ${entity.status}
- **Fuente:** ${entity.sourceQuestionId ?? "No especificada"}

${entity.description}

**Información pendiente de definición:**

- Identificador de negocio.
- Atributos obligatorios y opcionales.
- Estados del ciclo de vida.
- Reglas de creación y modificación.
- Relaciones con otras entidades.
- Responsable de cada operación.
- Reglas de autorización y visibilidad.`
    )
    .join("\n\n");
}

function renderCandidateBoundaries(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No pueden proponerse límites de dominio hasta identificar entidades."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. Límite candidato: ${entity.name}

La entidad **${entity.name}** puede representar el centro de una capacidad o límite funcional, pero todavía no existe información suficiente para clasificarla como entidad, agregado raíz, value object o servicio de dominio.

**Validaciones necesarias:**

1. Determinar quién crea y modifica ${entity.name}.
2. Identificar sus invariantes.
3. Confirmar qué operaciones deben ser atómicas.
4. Definir qué otras entidades controla directamente.
5. Confirmar si pertenece a un contexto delimitado mayor.`
    )
    .join("\n\n");
}

function renderDomainCapabilities(
  model: ProjectModel
): string {
  const requirements = model.requirements.filter(
    (requirement) =>
      requirement.status !== "rejected"
  );

  if (requirements.length === 0) {
    return renderEmptyState(
      "No existen requisitos activos para derivar capacidades del dominio."
    );
  }

  return requirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

- **Tipo:** ${requirement.type}
- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

${requirement.description}

**Pregunta de modelado:** ¿qué entidad, agregado, servicio o proceso del dominio será responsable de garantizar esta capacidad?`
    )
    .join("\n\n");
}

function renderRelationshipBacklog(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades suficientes para analizar relaciones."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `${index + 1}. **${entity.name}**
   - ¿Qué otras entidades necesita para completar sus operaciones?
   - ¿Qué entidad puede existir independientemente?
   - ¿Qué relaciones requieren cardinalidad uno a uno, uno a muchos o muchos a muchos?
   - ¿Qué referencias deben persistirse como identificadores?
   - ¿Qué relaciones deben evitar acoplamiento directo entre contextos?`
    )
    .join("\n\n");
}

function renderDomainConstraints(
  model: ProjectModel
): string {
  const constraints = model.requirements.filter(
    (requirement) =>
      requirement.status !== "rejected" &&
      (
        requirement.type === "security" ||
        requirement.type === "non_functional" ||
        requirement.type === "integration" ||
        requirement.type === "operational"
      )
  );

  if (constraints.length === 0) {
    return renderEmptyState(
      "No se han registrado restricciones transversales explícitas."
    );
  }

  return constraints
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

- **Categoría:** ${requirement.type}
- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}

${requirement.description}`
    )
    .join("\n\n");
}

function renderAssumptions(
  model: ProjectModel
): string {
  if (model.assumptions.length === 0) {
    return renderEmptyState(
      "No hay supuestos registrados."
    );
  }

  return model.assumptions
    .map(
      (assumption, index) => `### ${index + 1}. ${assumption.statement}

- **Impacto:** ${assumption.impact}
- **Estado:** ${assumption.status}
- **Fuente:** ${assumption.sourceQuestionId ?? "No especificada"}

**Implicación para el dominio:** este supuesto puede modificar entidades, límites, relaciones o reglas y debe confirmarse antes de aprobar el modelo.`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos de dominio registrados."
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

function renderOpenQuestions(
  model: ProjectModel
): string {
  if (model.openQuestions.length === 0) {
    return renderEmptyState(
      "No hay preguntas abiertas críticas."
    );
  }

  return model.openQuestions
    .map(
      (item, index) => `### ${index + 1}. ${item.question}

- **Prioridad:** ${item.priority}
- **Razón:** ${item.reason}

**Impacto potencial:** la respuesta puede cambiar entidades, responsabilidades, relaciones o límites del dominio.`
    )
    .join("\n\n");
}

export function generateDomainModelMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Domain Model — ${project.name}

## 1. Estado del documento

- **Tipo:** Domain Model
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este documento representa un modelo de dominio preliminar. Las entidades fueron detectadas desde la entrevista, pero sus atributos, relaciones, cardinalidades, agregados e invariantes todavía requieren refinamiento.

---

## 2. Contexto del producto

### Descripción

${project.description || "No hay descripción inicial disponible."}

### Objetivo principal

${project.mainGoal || "No definido."}

### Contexto general

- **Industria:** ${project.industry || "No definida"}
- **Tipo de producto:** ${project.productType}
- **Estado del proyecto:** ${project.status}

---

## 3. Alcance del dominio

El dominio inicial comprende los conceptos, capacidades y reglas necesarias para cumplir el objetivo principal del proyecto.

Este documento no confirma todavía:

- La estructura definitiva de la base de datos.
- Los límites finales de agregados.
- Las relaciones y cardinalidades.
- Los eventos de dominio.
- Los comandos y consultas.
- Los contextos delimitados definitivos.
- La distribución entre servicios o módulos.

---

## 4. Lenguaje ubicuo inicial

${renderUbiquitousLanguage(model)}

---

## 5. Catálogo de entidades

${renderEntityCatalog(model)}

---

## 6. Límites y agregados candidatos

${renderCandidateBoundaries(model)}

> Estas propuestas no declaran que cada entidad sea un agregado raíz. Solo identifican áreas que necesitan análisis de consistencia, propiedad y ciclo de vida.

---

## 7. Capacidades y reglas detectadas

${renderDomainCapabilities(model)}

---

## 8. Relaciones pendientes de definición

${renderRelationshipBacklog(model)}

---

## 9. Restricciones transversales

${renderDomainConstraints(model)}

---

## 10. Supuestos que afectan el dominio

${renderAssumptions(model)}

---

## 11. Riesgos del modelo

${renderRisks(model)}

---

## 12. Preguntas abiertas

${renderOpenQuestions(model)}

---

## 13. Trabajo de refinamiento requerido

Para convertir este borrador en un modelo de dominio aprobado se debe:

1. Validar el lenguaje ubicuo con responsables del producto.
2. Confirmar o rechazar cada entidad propuesta.
3. Definir atributos y tipos de datos conceptuales.
4. Documentar identificadores naturales y técnicos.
5. Definir estados y transiciones de ciclo de vida.
6. Identificar invariantes y reglas de consistencia.
7. Establecer relaciones y cardinalidades.
8. Identificar agregados y sus raíces.
9. Separar entidades de value objects.
10. Detectar servicios y eventos de dominio.
11. Delimitar contextos funcionales.
12. Confirmar reglas de autorización y aislamiento.
13. Validar integraciones con sistemas externos.
14. Relacionar cada elemento con su requisito de origen.

---

## 14. Criterios de aprobación

El Domain Model podrá considerarse aprobado cuando:

- Los términos principales tengan una definición compartida.
- Las entidades hayan sido confirmadas.
- Las relaciones críticas estén documentadas.
- Las invariantes sean verificables.
- Los agregados tengan límites claros.
- Las operaciones principales tengan un responsable de dominio.
- Los requisitos obligatorios tengan trazabilidad.
- Los riesgos de impacto alto tengan una mitigación aceptada.
- Las preguntas de prioridad alta estén resueltas.

---

## 15. Nota de trazabilidad

Las entidades y capacidades de este documento provienen del Project Model generado desde la entrevista. Cada decisión posterior debe mantener referencia a requisitos, preguntas y fuentes originales.
`;
}
