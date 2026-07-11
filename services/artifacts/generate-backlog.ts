import type { FoundationProject } from "@/domain/projects/project";
import type {
  ProjectModel,
  ProjectRequirement,
  RequirementType,
} from "@/domain/project-model/project-model";

type RequirementGroup = {
  type: RequirementType;
  title: string;
  description: string;
};

const requirementGroups: RequirementGroup[] = [
  {
    type: "functional",
    title: "Capacidades funcionales",
    description:
      "Comportamientos y flujos que entregan valor directo a los usuarios.",
  },
  {
    type: "security",
    title: "Seguridad y autorización",
    description:
      "Controles de identidad, permisos, aislamiento, privacidad y protección.",
  },
  {
    type: "integration",
    title: "Integraciones",
    description:
      "Contratos y flujos con sistemas o proveedores externos.",
  },
  {
    type: "reporting",
    title: "Reportes y visibilidad",
    description:
      "Consultas, métricas, reportes y capacidades de seguimiento.",
  },
  {
    type: "operational",
    title: "Operación y soporte",
    description:
      "Despliegue, observabilidad, recuperación y operación del producto.",
  },
  {
    type: "non_functional",
    title: "Atributos de calidad",
    description:
      "Rendimiento, disponibilidad, escalabilidad, accesibilidad y mantenibilidad.",
  },
];

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

function createProjectPrefix(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g);

  if (!words || words.length === 0) {
    return "PRJ";
  }

  if (words.length === 1) {
    return words[0].slice(0, 4).padEnd(3, "X");
  }

  return words
    .slice(0, 4)
    .map((word) => word[0])
    .join("");
}

function formatItemNumber(value: number): string {
  return String(value).padStart(3, "0");
}

function getActiveRequirements(
  model: ProjectModel
): ProjectRequirement[] {
  return model.requirements.filter(
    (requirement) =>
      requirement.status !== "rejected"
  );
}

function getPriorityLabel(
  priority: ProjectRequirement["priority"]
): string {
  switch (priority) {
    case "must":
      return "Must";
    case "should":
      return "Should";
    case "could":
      return "Could";
  }
}

function getStatusGuidance(
  status: ProjectRequirement["status"]
): string {
  switch (status) {
    case "confirmed":
      return "Puede avanzar a refinamiento e implementación.";
    case "assumed":
      return "Debe confirmarse antes de cerrar el alcance.";
    case "proposed":
      return "Requiere revisión y aceptación explícita.";
    case "unresolved":
      return "Está bloqueado hasta resolver la información faltante.";
    case "rejected":
      return "No debe incluirse en el backlog activo.";
  }
}

function renderBacklogSummary(
  model: ProjectModel
): string {
  const activeRequirements =
    getActiveRequirements(model);

  const mustCount = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "must"
  ).length;

  const shouldCount = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "should"
  ).length;

  const couldCount = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "could"
  ).length;

  const confirmedCount =
    activeRequirements.filter(
      (requirement) =>
        requirement.status === "confirmed"
    ).length;

  const unresolvedCount =
    activeRequirements.filter(
      (requirement) =>
        requirement.status === "unresolved"
    ).length;

  return `| Categoría | Cantidad |
|---|---:|
| Requisitos activos | ${activeRequirements.length} |
| Prioridad Must | ${mustCount} |
| Prioridad Should | ${shouldCount} |
| Prioridad Could | ${couldCount} |
| Requisitos confirmados | ${confirmedCount} |
| Requisitos sin resolver | ${unresolvedCount} |
| Entidades de dominio | ${model.domainEntities.length} |
| Riesgos | ${model.risks.length} |
| Preguntas abiertas | ${model.openQuestions.length} |`;
}

function renderRequirementEpic(input: {
  group: RequirementGroup;
  requirements: ProjectRequirement[];
  prefix: string;
  startingIndex: number;
}): {
  content: string;
  nextIndex: number;
} {
  const {
    group,
    requirements,
    prefix,
    startingIndex,
  } = input;

  if (requirements.length === 0) {
    return {
      content: `## Épica — ${group.title}

${group.description}

${renderEmptyState(
  "No se detectaron requisitos activos en esta categoría."
)}`,
      nextIndex: startingIndex,
    };
  }

  let currentIndex = startingIndex;

  const items = requirements
    .map((requirement) => {
      const itemId = `${prefix}-${formatItemNumber(
        currentIndex
      )}`;

      currentIndex += 1;

      return `### ${itemId} — ${requirement.title}

**Objetivo**

${requirement.description}

**Clasificación**

- **Tipo:** ${requirement.type}
- **Prioridad:** ${getPriorityLabel(
        requirement.priority
      )}
- **Estado de confirmación:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

**Criterios de aceptación candidatos**

- El comportamiento descrito puede demostrarse mediante un flujo verificable.
- La implementación satisface explícitamente: ${requirement.description}
- Los estados inválidos y errores relevantes tienen comportamiento definido.
- Las validaciones sensibles se ejecutan en una capa confiable.
- Existen pruebas proporcionales al riesgo y prioridad del requisito.
- Se conserva trazabilidad con el requisito y su fuente.

**Condición de preparación**

${getStatusGuidance(requirement.status)}

**Dependencias por confirmar**

- Actores autorizados.
- Datos requeridos.
- Reglas de negocio.
- Estados y transiciones.
- Integraciones relacionadas.
- Restricciones de seguridad.
- Diseño de persistencia.`;
    })
    .join("\n\n");

  return {
    content: `## Épica — ${group.title}

${group.description}

${items}`,
    nextIndex: currentIndex,
  };
}

function renderRequirementBacklog(input: {
  model: ProjectModel;
  prefix: string;
}): {
  content: string;
  nextIndex: number;
} {
  const activeRequirements =
    getActiveRequirements(input.model);

  let currentIndex = 1;
  const sections: string[] = [];

  for (const group of requirementGroups) {
    const requirements = activeRequirements.filter(
      (requirement) =>
        requirement.type === group.type
    );

    const rendered = renderRequirementEpic({
      group,
      requirements,
      prefix: input.prefix,
      startingIndex: currentIndex,
    });

    sections.push(rendered.content);
    currentIndex = rendered.nextIndex;
  }

  return {
    content: sections.join("\n\n---\n\n"),
    nextIndex: currentIndex,
  };
}

function renderDomainWork(input: {
  model: ProjectModel;
  prefix: string;
  startingIndex: number;
}): {
  content: string;
  nextIndex: number;
} {
  const {
    model,
    prefix,
    startingIndex,
  } = input;

  if (model.domainEntities.length === 0) {
    return {
      content: renderEmptyState(
        "No existen entidades de dominio suficientes para generar trabajo de modelado."
      ),
      nextIndex: startingIndex,
    };
  }

  let currentIndex = startingIndex;

  const items = model.domainEntities
    .map((entity) => {
      const itemId = `${prefix}-${formatItemNumber(
        currentIndex
      )}`;

      currentIndex += 1;

      return `### ${itemId} — Refinar ${entity.name}

**Objetivo**

Convertir la entidad conceptual **${entity.name}** en un elemento de dominio suficientemente definido para diseño e implementación.

**Descripción actual**

${entity.description}

**Estado:** ${entity.status}

**Fuente:** ${entity.sourceQuestionId ?? "No especificada"}

**Trabajo requerido**

- Confirmar la definición y responsabilidad de la entidad.
- Definir atributos obligatorios y opcionales.
- Identificar su propietario lógico.
- Definir estados y ciclo de vida.
- Documentar invariantes.
- Confirmar relaciones y cardinalidades.
- Definir operaciones permitidas.
- Determinar persistencia y restricciones.
- Definir reglas de autorización.
- Identificar eventos relevantes.

**Criterios de aceptación**

- La entidad tiene una definición no ambigua.
- Sus invariantes están documentadas.
- Sus relaciones principales están confirmadas.
- Su ciclo de vida puede representarse y probarse.
- Las decisiones pendientes están explícitamente registradas.`;
    })
    .join("\n\n");

  return {
    content: items,
    nextIndex: currentIndex,
  };
}

function renderRiskWork(input: {
  model: ProjectModel;
  prefix: string;
  startingIndex: number;
}): {
  content: string;
  nextIndex: number;
} {
  const {
    model,
    prefix,
    startingIndex,
  } = input;

  if (model.risks.length === 0) {
    return {
      content: renderEmptyState(
        "No existen riesgos registrados para convertir en trabajo de mitigación."
      ),
      nextIndex: startingIndex,
    };
  }

  let currentIndex = startingIndex;

  const items = model.risks
    .map((risk) => {
      const itemId = `${prefix}-${formatItemNumber(
        currentIndex
      )}`;

      currentIndex += 1;

      return `### ${itemId} — Mitigar: ${risk.title}

**Riesgo**

${risk.description}

- **Probabilidad:** ${risk.probability}
- **Impacto:** ${risk.impact}

**Mitigación propuesta**

${risk.mitigation}

**Criterios de aceptación**

- Existe un control o decisión concreta para reducir el riesgo.
- La mitigación tiene evidencia verificable.
- Se documenta el riesgo residual.
- Se identifica cuándo debe revisarse nuevamente.
- Los requisitos o artefactos afectados quedan actualizados.`;
    })
    .join("\n\n");

  return {
    content: items,
    nextIndex: currentIndex,
  };
}

function renderDiscoveryWork(input: {
  model: ProjectModel;
  prefix: string;
  startingIndex: number;
}): {
  content: string;
  nextIndex: number;
} {
  const {
    model,
    prefix,
    startingIndex,
  } = input;

  if (model.openQuestions.length === 0) {
    return {
      content: renderEmptyState(
        "No existen preguntas abiertas para convertir en actividades de descubrimiento."
      ),
      nextIndex: startingIndex,
    };
  }

  let currentIndex = startingIndex;

  const items = model.openQuestions
    .map((item) => {
      const itemId = `${prefix}-${formatItemNumber(
        currentIndex
      )}`;

      currentIndex += 1;

      return `### ${itemId} — Resolver: ${item.question}

**Tipo:** Descubrimiento

**Prioridad:** ${item.priority}

**Razón**

${item.reason}

**Resultado esperado**

- Una respuesta explícita y verificable.
- Identificación de la persona o fuente que confirma la decisión.
- Actualización del Project Model.
- Actualización de los requisitos y documentos afectados.
- Registro de nuevos riesgos o supuestos cuando corresponda.

> Este ítem no debe cerrarse mediante una suposición no documentada.`;
    })
    .join("\n\n");

  return {
    content: items,
    nextIndex: currentIndex,
  };
}

function renderAssumptionWork(input: {
  model: ProjectModel;
  prefix: string;
  startingIndex: number;
}): {
  content: string;
  nextIndex: number;
} {
  const assumptions =
    input.model.assumptions.filter(
      (assumption) =>
        assumption.status !== "confirmed" &&
        assumption.status !== "rejected"
    );

  if (assumptions.length === 0) {
    return {
      content: renderEmptyState(
        "No existen supuestos activos pendientes de validación."
      ),
      nextIndex: input.startingIndex,
    };
  }

  let currentIndex = input.startingIndex;

  const items = assumptions
    .map((assumption) => {
      const itemId = `${input.prefix}-${formatItemNumber(
        currentIndex
      )}`;

      currentIndex += 1;

      return `### ${itemId} — Validar supuesto

**Supuesto**

${assumption.statement}

- **Impacto:** ${assumption.impact}
- **Estado:** ${assumption.status}
- **Fuente:** ${assumption.sourceQuestionId ?? "No especificada"}

**Criterios de aceptación**

- El supuesto queda confirmado, rechazado o reformulado.
- Se registra evidencia o fuente de la decisión.
- Se identifican requisitos y documentos afectados.
- Se actualiza el Project Model.
- Los cambios de alcance resultantes quedan reflejados en el backlog.`;
    })
    .join("\n\n");

  return {
    content: items,
    nextIndex: currentIndex,
  };
}

function renderPriorityOrder(
  model: ProjectModel
): string {
  const activeRequirements =
    getActiveRequirements(model);

  const must = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "must"
  );

  const should = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "should"
  );

  const could = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "could"
  );

  const renderRows = (
    requirements: ProjectRequirement[]
  ): string =>
    requirements.length === 0
      ? "| — | No hay requisitos en esta prioridad. |"
      : requirements
          .map(
            (requirement) =>
              `| ${escapeTableCell(requirement.title)} | ${requirement.status} |`
          )
          .join("\n");

  return `### Must

| Requisito | Estado |
|---|---|
${renderRows(must)}

### Should

| Requisito | Estado |
|---|---|
${renderRows(should)}

### Could

| Requisito | Estado |
|---|---|
${renderRows(could)}`;
}

function renderSuggestedSequence(
  model: ProjectModel
): string {
  const hasSecurity = getActiveRequirements(
    model
  ).some(
    (requirement) =>
      requirement.type === "security"
  );

  const hasIntegrations = getActiveRequirements(
    model
  ).some(
    (requirement) =>
      requirement.type === "integration"
  );

  return `1. Resolver preguntas abiertas de prioridad alta.
2. Validar supuestos de impacto alto.
3. Confirmar requisitos Must todavía propuestos o sin resolver.
4. Refinar actores, permisos y límites del dominio.
5. Definir entidades, relaciones e invariantes principales.
${hasSecurity ? "6. Diseñar y probar controles de seguridad obligatorios." : "6. Confirmar requisitos mínimos de seguridad."}
${hasIntegrations ? "7. Definir contratos e idempotencia de integraciones." : "7. Confirmar si existen integraciones externas."}
8. Implementar un vertical slice de extremo a extremo.
9. Incorporar requisitos Should después de estabilizar el flujo principal.
10. Evaluar requisitos Could únicamente después de validar el MVP.

> Esta secuencia es orientativa. Las dependencias reales deben confirmarse durante refinamiento.`;
}

export function generateBacklogMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;
  const prefix = createProjectPrefix(project.name);

  const requirementBacklog =
    renderRequirementBacklog({
      model,
      prefix,
    });

  const domainWork = renderDomainWork({
    model,
    prefix,
    startingIndex:
      requirementBacklog.nextIndex,
  });

  const riskWork = renderRiskWork({
    model,
    prefix,
    startingIndex: domainWork.nextIndex,
  });

  const discoveryWork =
    renderDiscoveryWork({
      model,
      prefix,
      startingIndex: riskWork.nextIndex,
    });

  const assumptionWork =
    renderAssumptionWork({
      model,
      prefix,
      startingIndex:
        discoveryWork.nextIndex,
    });

  const totalItems =
    assumptionWork.nextIndex - 1;

  return `# Backlog — ${project.name}

## 1. Estado del documento

- **Tipo:** Product and Technical Backlog
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Prefijo de ítems:** ${prefix}
- **Ítems generados:** ${totalItems}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este backlog es una propuesta inicial. No incluye estimaciones, responsables ni fechas porque esos datos no están confirmados en el Project Model.

---

## 2. Contexto del producto

### Descripción

${project.description || "No hay descripción inicial disponible."}

### Objetivo principal

${project.mainGoal || "No definido."}

### Clasificación

- **Industria:** ${project.industry || "No definida"}
- **Tipo de producto:** ${project.productType}
- **Nivel técnico declarado:** ${project.technicalLevel}
- **Estado del proyecto:** ${project.status}

---

## 3. Resumen del backlog

${renderBacklogSummary(model)}

---

## 4. Reglas de interpretación

- **Must:** necesario para que el alcance inicial cumpla su propósito principal.
- **Should:** importante, pero puede planificarse después del núcleo obligatorio.
- **Could:** mejora opcional que no debe bloquear el MVP.
- **Confirmed:** existe evidencia suficiente para refinar el ítem.
- **Assumed:** depende de una hipótesis pendiente.
- **Proposed:** requiere aceptación explícita.
- **Unresolved:** no debe implementarse sin resolver información crítica.
- **Rejected:** queda fuera del backlog activo.

---

## 5. Backlog derivado de requisitos

${requirementBacklog.content}

---

## 6. Trabajo de modelado del dominio

${domainWork.content}

---

## 7. Trabajo de mitigación de riesgos

${riskWork.content}

---

## 8. Actividades de descubrimiento

${discoveryWork.content}

---

## 9. Validación de supuestos

${assumptionWork.content}

---

## 10. Priorización actual

${renderPriorityOrder(model)}

---

## 11. Secuencia sugerida

${renderSuggestedSequence(model)}

---

## 12. Definition of Ready

Un ítem puede entrar en implementación cuando:

- Su objetivo es comprensible.
- Tiene una fuente trazable.
- Los actores involucrados están identificados.
- Los criterios de aceptación son verificables.
- Sus dependencias principales son conocidas.
- Los datos necesarios están definidos.
- Las reglas de autorización están claras.
- Los riesgos críticos tienen tratamiento.
- No depende de una pregunta abierta de prioridad alta.
- No se basa únicamente en un supuesto de impacto alto.

---

## 13. Definition of Done

Un ítem puede considerarse terminado cuando:

- Los criterios de aceptación se cumplen.
- La implementación conserva integridad y autorización.
- Las pruebas necesarias pasan.
- Los errores relevantes tienen comportamiento definido.
- La observabilidad requerida está disponible.
- La documentación afectada fue actualizada.
- Las migraciones son reproducibles cuando existen cambios de datos.
- No se introdujeron secretos ni configuraciones inseguras.
- El cambio fue revisado.
- El flujo puede demostrarse en un ambiente válido.

---

## 14. Dependencias que deben registrarse

Para cada ítem debe confirmarse:

- Requisitos previos.
- Entidades afectadas.
- Integraciones.
- Migraciones.
- Permisos.
- Dependencias de interfaz.
- Dependencias operacionales.
- Riesgos.
- Artefactos relacionados.
- Preguntas pendientes.

---

## 15. Estimación

No se generaron estimaciones automáticas.

Las estimaciones deberían incorporarse después de:

1. Confirmar el alcance.
2. Refinar criterios de aceptación.
3. Identificar dependencias.
4. Definir la estrategia técnica.
5. Separar investigación de implementación.
6. Evaluar capacidad y experiencia del equipo.

No debe utilizarse una estimación generada sin participación del equipo responsable de ejecutar el trabajo.

---

## 16. Criterios de aprobación

El backlog podrá considerarse listo para planificación cuando:

- Los requisitos Must estén confirmados.
- Las preguntas de prioridad alta estén resueltas.
- Los supuestos de impacto alto estén validados.
- Las dependencias críticas sean visibles.
- Los ítems tengan criterios verificables.
- Los riesgos principales tengan tareas de mitigación.
- El vertical slice inicial pueda identificarse.
- El alcance MVP sea consistente con MVP_SCOPE.md.
- La arquitectura y el modelo de datos no contradigan los ítems.
- El equipo pueda estimar sin depender de información esencial ausente.

---

## 17. Nota de trazabilidad

Este backlog fue derivado del Foundation Project y del Project Model. Todo ítem debe mantener relación con un requisito, entidad, riesgo, supuesto o pregunta abierta.
`;
}
