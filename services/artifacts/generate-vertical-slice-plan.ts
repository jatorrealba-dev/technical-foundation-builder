import type { FoundationProject } from "@/domain/projects/project";
import type {
  ProjectModel,
  ProjectRequirement,
} from "@/domain/project-model/project-model";

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

function getActiveRequirements(
  model: ProjectModel
): ProjectRequirement[] {
  return model.requirements.filter(
    (requirement) =>
      requirement.status !== "rejected"
  );
}

function getPrimaryRequirements(
  model: ProjectModel
): ProjectRequirement[] {
  const activeRequirements =
    getActiveRequirements(model);

  const confirmedMust = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "must" &&
      requirement.status === "confirmed"
  );

  if (confirmedMust.length > 0) {
    return confirmedMust;
  }

  const allMust = activeRequirements.filter(
    (requirement) =>
      requirement.priority === "must"
  );

  if (allMust.length > 0) {
    return allMust;
  }

  const confirmed = activeRequirements.filter(
    (requirement) =>
      requirement.status === "confirmed"
  );

  if (confirmed.length > 0) {
    return confirmed;
  }

  return activeRequirements;
}

function getPrimaryFunctionalRequirements(
  model: ProjectModel
): ProjectRequirement[] {
  return getPrimaryRequirements(model).filter(
    (requirement) =>
      requirement.type === "functional"
  );
}

function renderSelectionRationale(
  model: ProjectModel
): string {
  const primaryRequirements =
    getPrimaryRequirements(model);

  const confirmedMust =
    primaryRequirements.filter(
      (requirement) =>
        requirement.priority === "must" &&
        requirement.status === "confirmed"
    );

  if (confirmedMust.length > 0) {
    return `El slice fue construido principalmente a partir de requisitos **Must confirmados**, porque representan el núcleo con mayor evidencia disponible.`;
  }

  const mustRequirements =
    primaryRequirements.filter(
      (requirement) =>
        requirement.priority === "must"
    );

  if (mustRequirements.length > 0) {
    return `No existen suficientes requisitos Must confirmados. El slice utiliza requisitos **Must todavía asumidos, propuestos o sin resolver**, por lo que debe validarse antes de comenzar la implementación.`;
  }

  if (primaryRequirements.length > 0) {
    return `No existen requisitos Must suficientes. El slice utiliza los requisitos activos con mayor nivel de confirmación disponible y debe considerarse provisional.`;
  }

  return `No existen requisitos activos suficientes para aprobar un vertical slice. El documento funciona como plantilla de descubrimiento.`;
}

function renderSelectedRequirements(
  model: ProjectModel
): string {
  const requirements =
    getPrimaryRequirements(model);

  if (requirements.length === 0) {
    return renderEmptyState(
      "No existen requisitos activos suficientes para seleccionar el alcance del slice."
    );
  }

  const rows = requirements
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.title)} | ${requirement.type} | ${requirement.priority} | ${requirement.status} | ${requirement.sourceQuestionId ?? "No especificada"} |`
    )
    .join("\n");

  return `| Requisito | Tipo | Prioridad | Estado | Fuente |
|---|---|---|---|---|
${rows}`;
}

function renderEndToEndFlow(
  model: ProjectModel
): string {
  const functionalRequirements =
    getPrimaryFunctionalRequirements(model);

  if (functionalRequirements.length === 0) {
    return `No existe todavía un flujo funcional suficientemente confirmado.

Flujo provisional:

1. Un actor autorizado accede al producto.
2. El actor inicia la operación principal.
3. El sistema valida identidad, permisos y entrada.
4. El dominio aplica las reglas confirmadas.
5. El sistema persiste el resultado de forma consistente.
6. La interfaz presenta el nuevo estado.
7. La operación genera evidencia observable.
8. El resultado puede verificarse mediante una prueba de extremo a extremo.`;
  }

  const steps = functionalRequirements
    .map(
      (requirement, index) =>
        `${index + 2}. El sistema ejecuta **${requirement.title}**: ${requirement.description}`
    )
    .join("\n");

  return `1. Un actor autorizado inicia el flujo principal.
${steps}
${functionalRequirements.length + 2}. El sistema valida el resultado final y conserva el estado necesario.
${functionalRequirements.length + 3}. La interfaz comunica éxito, error o siguiente acción.
${functionalRequirements.length + 4}. La operación queda disponible para pruebas, observabilidad y auditoría cuando corresponda.

> El orden definitivo debe revisarse contra las reglas del dominio y las dependencias reales.`;
}

function renderFunctionalScope(
  model: ProjectModel
): string {
  const functionalRequirements =
    getPrimaryFunctionalRequirements(model);

  if (functionalRequirements.length === 0) {
    return renderEmptyState(
      "No existen requisitos funcionales suficientes para definir el comportamiento principal."
    );
  }

  return functionalRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

${requirement.description}

- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

**Resultado demostrable**

- El comportamiento puede ejecutarse desde una interfaz válida.
- Las reglas relevantes se aplican en una capa confiable.
- El estado final puede consultarse.
- Los errores relevantes tienen respuesta definida.
- Existe al menos una prueba automatizada del flujo.`
    )
    .join("\n\n");
}

function renderInterfaceResponsibilities(
  model: ProjectModel
): string {
  const functionalRequirements =
    getPrimaryFunctionalRequirements(model);

  if (functionalRequirements.length === 0) {
    return `La interfaz mínima debe permitir:

- Iniciar el flujo principal.
- Capturar la información necesaria.
- Mostrar validaciones.
- Comunicar estados de carga.
- Mostrar errores sin revelar detalles sensibles.
- Presentar el resultado final.
- Permitir repetir o corregir la operación cuando sea válido.`;
  }

  return functionalRequirements
    .map(
      (requirement, index) => `### ${index + 1}. Interacción para ${requirement.title}

La interfaz debe permitir iniciar y completar este comportamiento:

${requirement.description}

Debe incluir:

- Entrada requerida.
- Validación visible.
- Estado de procesamiento.
- Manejo de error.
- Resultado final.
- Restricción según permisos.
- Accesibilidad básica.
- Comportamiento verificable mediante pruebas de usuario o end-to-end.`
    )
    .join("\n\n");
}

function renderApplicationResponsibilities(
  model: ProjectModel
): string {
  const requirements =
    getPrimaryRequirements(model);

  if (requirements.length === 0) {
    return `La capa de aplicación deberá:

- Recibir la intención del actor.
- Validar autenticación y autorización.
- Validar entrada.
- Coordinar reglas del dominio.
- Gestionar transacciones.
- Persistir el resultado.
- Traducir errores.
- Emitir información de observabilidad.`;
  }

  return requirements
    .map(
      (requirement, index) => `### ${index + 1}. Caso de uso: ${requirement.title}

La capa de aplicación deberá coordinar:

- Validación del actor.
- Validación de entrada.
- Carga de datos requeridos.
- Ejecución de reglas.
- Persistencia atómica cuando corresponda.
- Manejo de errores.
- Respuesta estructurada.
- Trazabilidad con el requisito.

**Descripción del requisito**

${requirement.description}`
    )
    .join("\n\n");
}

function renderDomainResponsibilities(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No existen entidades de dominio suficientes para asignar responsabilidades."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. ${entity.name}

${entity.description}

- **Estado:** ${entity.status}
- **Fuente:** ${entity.sourceQuestionId ?? "No especificada"}

Para el slice debe confirmarse:

- Qué responsabilidad cumple.
- Qué estado inicial necesita.
- Qué operación modifica su estado.
- Qué invariantes protege.
- Qué datos son obligatorios.
- Qué actor puede operarla.
- Qué resultado debe persistirse.`
    )
    .join("\n\n");
}

function renderDataResponsibilities(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return `La persistencia mínima deberá:

- Conservar el resultado principal del flujo.
- Mantener identificadores estables.
- Aplicar restricciones de integridad.
- Registrar fechas de creación y actualización.
- Evitar duplicados en operaciones repetidas.
- Preservar ownership o tenancy cuando corresponda.
- Permitir consultar el estado final.`;
  }

  const rows = model.domainEntities
    .map(
      (entity) =>
        `| ${escapeTableCell(entity.name)} | ${entity.status} | Pendiente | Pendiente |`
    )
    .join("\n");

  return `| Entidad | Estado conceptual | Persistencia requerida | Restricciones |
|---|---|---|---|
${rows}

Para el slice se debe implementar únicamente la persistencia estrictamente necesaria para demostrar el flujo, sin adelantar tablas o relaciones especulativas.`;
}

function renderSecurityScope(
  model: ProjectModel
): string {
  const securityRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "security"
    );

  if (securityRequirements.length === 0) {
    return `No existen requisitos de seguridad explícitos suficientes.

Controles mínimos del slice:

- Validar autenticación cuando el flujo no sea público.
- Autorizar cada operación sensible en el servidor.
- No confiar en identificadores del cliente.
- Validar entradas.
- Mantener secretos fuera del cliente.
- Evitar exposición de detalles internos en errores.
- Probar al menos un caso de acceso denegado.
- Verificar aislamiento de recursos cuando corresponda.`;
  }

  return securityRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

${requirement.description}

- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}

**Validación dentro del slice**

- Existe un control concreto.
- El control se aplica en el servidor.
- Se prueba el caso permitido.
- Se prueba al menos un caso denegado.
- El error no revela información sensible.
- La evidencia se conserva en pruebas o auditoría.`
    )
    .join("\n\n");
}

function renderIntegrationScope(
  model: ProjectModel
): string {
  const integrationRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "integration"
    );

  if (integrationRequirements.length === 0) {
    return `No se han confirmado integraciones externas necesarias para el slice.

No debe incorporarse un proveedor externo únicamente para completar la arquitectura.`;
  }

  return integrationRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

${requirement.description}

Para incluir esta integración en el slice se requiere:

- Contrato mínimo definido.
- Credenciales protegidas.
- Timeout.
- Manejo de errores.
- Validación de respuesta.
- Reintentos solamente cuando sean seguros.
- Idempotencia cuando exista efecto externo.
- Estrategia de prueba o entorno sandbox.
- Observabilidad básica.`
    )
    .join("\n\n");
}

function renderObservabilityScope(
  model: ProjectModel
): string {
  const operationalRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "operational"
    );

  const requirementContent =
    operationalRequirements.length === 0
      ? renderEmptyState(
          "No existen requisitos operacionales explícitos."
        )
      : operationalRequirements
          .map(
            (requirement, index) => `${index + 1}. **${requirement.title}**
   - ${requirement.description}
   - Prioridad: ${requirement.priority}
   - Estado: ${requirement.status}`
          )
          .join("\n");

  return `${requirementContent}

Observabilidad mínima del slice:

- Error logging estructurado.
- Resultado de la operación.
- Identificador de correlación cuando sea útil.
- Tiempo de ejecución de la operación principal.
- Registro de fallos de integración.
- Auditoría de acciones sensibles cuando corresponda.
- Ningún secreto o token completo en logs.`;
}

function renderAcceptanceCriteria(
  model: ProjectModel
): string {
  const requirements =
    getPrimaryRequirements(model);

  if (requirements.length === 0) {
    return `- El usuario puede iniciar el flujo principal.
- El sistema valida entrada y permisos.
- El dominio produce un resultado consistente.
- El resultado se persiste cuando corresponde.
- La interfaz muestra el estado final.
- Los errores relevantes están controlados.
- Existe una prueba end-to-end.
- El flujo puede desplegarse de forma reproducible.`;
  }

  const requirementCriteria = requirements
    .map(
      (requirement) =>
        `- **${requirement.title}:** ${requirement.description}`
    )
    .join("\n");

  return `${requirementCriteria}

Criterios transversales:

- El flujo puede ejecutarse desde la interfaz hasta la persistencia.
- Las validaciones sensibles se ejecutan en el servidor.
- La autorización se verifica para cada operación protegida.
- El resultado puede consultarse después de recargar.
- Los estados de error tienen comportamiento definido.
- Las pruebas automatizadas cubren el camino principal.
- Existe al menos una prueba negativa.
- El build de producción termina correctamente.
- El cambio puede desplegarse mediante un proceso reproducible.`;
}

function renderTestPlan(
  model: ProjectModel
): string {
  const primaryRequirements =
    getPrimaryRequirements(model);

  const requirementTests =
    primaryRequirements.length === 0
      ? renderEmptyState(
          "No existen requisitos suficientes para derivar pruebas específicas."
        )
      : primaryRequirements
          .map(
            (requirement, index) => `### ${index + 1}. ${requirement.title}

- Prueba del caso válido.
- Prueba de entrada inválida.
- Prueba de autorización cuando corresponda.
- Prueba de persistencia o efecto observable.
- Prueba de error relevante.
- Verificación de trazabilidad con el requisito.`
          )
          .join("\n\n");

  return `${requirementTests}

### Pruebas transversales

- Prueba unitaria de reglas críticas.
- Prueba de integración de persistencia.
- Prueba de aislamiento de datos cuando corresponda.
- Prueba de contrato para integraciones externas.
- Prueba end-to-end del flujo completo.
- Prueba de regresión para el resultado principal.`;
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No existen riesgos registrados para el slice."
    );
  }

  return model.risks
    .map(
      (risk, index) => `### ${index + 1}. ${risk.title}

- **Probabilidad:** ${risk.probability}
- **Impacto:** ${risk.impact}

${risk.description}

**Mitigación dentro del slice**

${risk.mitigation}

**Evidencia requerida**

- Control implementado o decisión documentada.
- Prueba o validación del control.
- Riesgo residual registrado.`
    )
    .join("\n\n");
}

function renderBlockers(
  model: ProjectModel
): string {
  const highPriorityQuestions =
    model.openQuestions.filter(
      (item) =>
        item.priority === "high"
    );

  const highImpactAssumptions =
    model.assumptions.filter(
      (assumption) =>
        assumption.impact === "high" &&
        assumption.status !== "confirmed" &&
        assumption.status !== "rejected"
    );

  const unresolvedMust =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.priority === "must" &&
        requirement.status === "unresolved"
    );

  const sections: string[] = [];

  if (unresolvedMust.length > 0) {
    sections.push(`### Requisitos Must sin resolver

${unresolvedMust
  .map(
    (requirement, index) =>
      `${index + 1}. **${requirement.title}** — ${requirement.description}`
  )
  .join("\n")}`);
  }

  if (highPriorityQuestions.length > 0) {
    sections.push(`### Preguntas abiertas de prioridad alta

${highPriorityQuestions
  .map(
    (item, index) =>
      `${index + 1}. **${item.question}**
   - Razón: ${item.reason}`
  )
  .join("\n")}`);
  }

  if (highImpactAssumptions.length > 0) {
    sections.push(`### Supuestos de impacto alto

${highImpactAssumptions
  .map(
    (assumption, index) =>
      `${index + 1}. ${assumption.statement}
   - Estado: ${assumption.status}`
  )
  .join("\n")}`);
  }

  if (sections.length === 0) {
    return renderEmptyState(
      "No se detectaron bloqueadores críticos explícitos."
    );
  }

  return sections.join("\n\n");
}

function renderOutOfScope(
  model: ProjectModel
): string {
  const excludedRequirements =
    model.requirements.filter(
      (requirement) =>
        requirement.status === "rejected" ||
        requirement.priority === "could"
    );

  if (excludedRequirements.length === 0) {
    return `Queda fuera del primer slice:

- Funcionalidad no necesaria para demostrar el flujo principal.
- Optimización prematura.
- Microservicios sin justificación.
- Automatizaciones no requeridas.
- Reportes secundarios.
- Integraciones opcionales.
- Personalización avanzada.
- Escalabilidad sin evidencia de carga.`;
  }

  const rows = excludedRequirements
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.title)} | ${requirement.priority} | ${requirement.status} |`
    )
    .join("\n");

  return `| Requisito | Prioridad | Estado |
|---|---|---|
${rows}

También queda fuera cualquier capacidad no necesaria para demostrar el flujo principal de extremo a extremo.`;
}

function renderImplementationSequence(
  model: ProjectModel
): string {
  const hasSecurity = getActiveRequirements(
    model
  ).some(
    (requirement) =>
      requirement.type === "security"
  );

  const hasIntegration = getActiveRequirements(
    model
  ).some(
    (requirement) =>
      requirement.type === "integration"
  );

  return `1. Resolver bloqueadores críticos.
2. Confirmar el flujo principal y sus actores.
3. Refinar las entidades estrictamente necesarias.
4. Definir contratos de entrada y salida.
5. Diseñar la persistencia mínima.
6. Implementar el caso de uso principal en el servidor.
7. Implementar la interfaz mínima.
${hasSecurity ? "8. Aplicar y probar los controles de seguridad confirmados." : "8. Aplicar autenticación, autorización y validación mínimas."}
${hasIntegration ? "9. Integrar el proveedor externo mediante un contrato controlado." : "9. Mantener fuera integraciones no confirmadas."}
10. Añadir observabilidad básica.
11. Completar pruebas unitarias e integración.
12. Completar la prueba end-to-end.
13. Ejecutar lint, tipos, pruebas y build.
14. Desplegar en un ambiente verificable.
15. Demostrar el flujo y registrar aprendizajes.`;
}

export function generateVerticalSlicePlanMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Vertical Slice Plan — ${project.name}

## 1. Estado del documento

- **Tipo:** Vertical Slice Plan
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> El objetivo de este documento es definir el slice mínimo que atraviese interfaz, aplicación, dominio, persistencia, seguridad, pruebas y despliegue.

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

## 3. Objetivo del vertical slice

Demostrar una capacidad real del producto mediante un flujo completo y verificable, evitando construir capas aisladas que todavía no entreguen valor observable.

El slice deberá validar:

- Utilidad del flujo principal.
- Límites iniciales del dominio.
- Estrategia de persistencia.
- Autenticación y autorización.
- Integridad de datos.
- Manejo de errores.
- Observabilidad.
- Capacidad de pruebas.
- Proceso de despliegue.

---

## 4. Criterio de selección

${renderSelectionRationale(model)}

---

## 5. Requisitos incluidos

${renderSelectedRequirements(model)}

---

## 6. Flujo de extremo a extremo

${renderEndToEndFlow(model)}

---

## 7. Alcance funcional

${renderFunctionalScope(model)}

---

## 8. Responsabilidades de interfaz

${renderInterfaceResponsibilities(model)}

---

## 9. Responsabilidades de aplicación

${renderApplicationResponsibilities(model)}

---

## 10. Responsabilidades de dominio

${renderDomainResponsibilities(model)}

---

## 11. Persistencia mínima

${renderDataResponsibilities(model)}

---

## 12. Seguridad incluida

${renderSecurityScope(model)}

---

## 13. Integraciones incluidas

${renderIntegrationScope(model)}

---

## 14. Observabilidad y operación

${renderObservabilityScope(model)}

---

## 15. Criterios de aceptación

${renderAcceptanceCriteria(model)}

---

## 16. Plan de pruebas

${renderTestPlan(model)}

---

## 17. Riesgos y mitigaciones

${renderRisks(model)}

---

## 18. Bloqueadores

${renderBlockers(model)}

---

## 19. Fuera de alcance

${renderOutOfScope(model)}

---

## 20. Secuencia de implementación

${renderImplementationSequence(model)}

---

## 21. Definition of Ready

El slice puede comenzar cuando:

- El flujo principal está descrito.
- El actor está identificado.
- Los requisitos Must esenciales están confirmados.
- Los criterios de aceptación son verificables.
- Las entidades principales están suficientemente definidas.
- La autorización está clara.
- Los datos mínimos están identificados.
- Las preguntas de prioridad alta que afectan el flujo están resueltas.
- Los riesgos críticos tienen una mitigación candidata.
- El equipo puede demostrar qué significa terminar.

---

## 22. Definition of Done

El slice puede considerarse terminado cuando:

- El flujo funciona de extremo a extremo.
- La interfaz permite completar la operación.
- El servidor valida entrada y permisos.
- El dominio conserva sus invariantes.
- El resultado se persiste correctamente.
- Los errores relevantes están controlados.
- Las pruebas requeridas pasan.
- Existe observabilidad básica.
- El build de producción es correcto.
- El flujo está desplegado en un ambiente válido.
- La demostración confirma o invalida las hipótesis principales.
- Los aprendizajes actualizan el Project Model y los artefactos afectados.

---

## 23. Resultado esperado

Al finalizar este slice, el equipo debe poder responder con evidencia:

1. ¿El flujo principal aporta valor?
2. ¿Los límites del dominio son razonables?
3. ¿La persistencia conserva integridad?
4. ¿La autorización protege los recursos?
5. ¿La arquitectura permite probar y desplegar?
6. ¿Qué supuestos fueron confirmados o rechazados?
7. ¿Qué debe cambiar antes del siguiente slice?

---

## 24. Nota de trazabilidad

Este plan fue derivado del Foundation Project y del Project Model. Cada elemento del slice debe mantener relación con un requisito, entidad, riesgo, supuesto o pregunta abierta.
`;
}
