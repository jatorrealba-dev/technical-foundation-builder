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

function toSnakeCase(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getActiveRequirements(
  model: ProjectModel
): ProjectRequirement[] {
  return model.requirements.filter(
    (requirement) =>
      requirement.status !== "rejected"
  );
}

function isMultiTenantCandidate(input: {
  project: FoundationProject;
  model: ProjectModel;
}): boolean {
  const { project, model } = input;

  if (project.productType === "saas") {
    return true;
  }

  const searchableText = [
    project.description,
    project.mainGoal,
    ...model.requirements.map(
      (requirement) =>
        `${requirement.title} ${requirement.description}`
    ),
    ...model.assumptions.map(
      (assumption) => assumption.statement
    ),
  ]
    .join(" ")
    .toLowerCase();

  return (
    searchableText.includes("multi-tenant") ||
    searchableText.includes("multitenant") ||
    searchableText.includes("tenant") ||
    searchableText.includes("organización") ||
    searchableText.includes("organizaciones") ||
    searchableText.includes("empresa") ||
    searchableText.includes("empresas")
  );
}

function renderEntityInventory(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No se han identificado entidades suficientes para proponer un modelo de datos."
    );
  }

  const rows = model.domainEntities
    .map((entity) => {
      const tableName =
        toSnakeCase(entity.name) || "pending_name";

      return `| ${escapeTableCell(entity.name)} | \`${tableName}\` | ${entity.status} | ${escapeTableCell(entity.description)} | ${entity.sourceQuestionId ?? "No especificada"} |`;
    })
    .join("\n");

  return `| Entidad conceptual | Tabla candidata | Estado | Responsabilidad inicial | Fuente |
|---|---|---|---|---|
${rows}`;
}

function renderCandidateTables(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades suficientes para proponer tablas."
    );
  }

  const multiTenant = isMultiTenantCandidate({
    project,
    model,
  });

  return model.domainEntities
    .map((entity, index) => {
      const tableName =
        toSnakeCase(entity.name) || `entity_${index + 1}`;

      const tenancyColumn = multiTenant
        ? `| \`organization_id\` o \`tenant_id\` | uuid | Condicional | Aislamiento del recurso por organización o tenant. Debe confirmarse el nombre y la entidad propietaria. |`
        : "";

      return `### ${index + 1}. Tabla candidata: \`${tableName}\`

**Entidad conceptual:** ${entity.name}

${entity.description}

| Columna candidata | Tipo conceptual | Obligatoria | Propósito |
|---|---|---|---|
| \`id\` | uuid | Sí | Identificador técnico estable. |
${tenancyColumn}
| \`created_at\` | timestamptz | Sí | Momento de creación del registro. |
| \`updated_at\` | timestamptz | Sí | Última modificación del registro. |

**Pendiente antes de crear la migración:**

- Definir los atributos de negocio.
- Identificar campos obligatorios y opcionales.
- Confirmar identificadores naturales.
- Definir estados del ciclo de vida.
- Establecer relaciones y claves foráneas.
- Determinar restricciones únicas.
- Definir reglas de eliminación.
- Definir autorización de lectura y escritura.
- Confirmar si necesita historial o auditoría.
- Verificar si realmente corresponde a una tabla independiente.

> La tabla \`${tableName}\` es una propuesta de nomenclatura, no un esquema aprobado.`;
    })
    .join("\n\n");
}

function renderRelationshipBacklog(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No existen entidades suficientes para analizar relaciones."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `${index + 1}. **${entity.name}**
   - ¿Qué entidad es su propietaria?
   - ¿Puede existir de forma independiente?
   - ¿Qué entidades referencia?
   - ¿Qué entidades pueden referenciarla?
   - ¿La relación es uno a uno, uno a muchos o muchos a muchos?
   - ¿La relación exige integridad referencial?
   - ¿Debe eliminarse en cascada, restringirse o conservarse?
   - ¿Necesita una tabla intermedia?
   - ¿La relación puede cruzar tenants u organizaciones?`
    )
    .join("\n\n");
}

function renderIntegrityRequirements(
  model: ProjectModel
): string {
  const requirements = getActiveRequirements(model);

  if (requirements.length === 0) {
    return renderEmptyState(
      "No existen requisitos activos para derivar restricciones de integridad."
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

**Decisiones de datos pendientes:**

- ¿Qué tablas y columnas representan este requisito?
- ¿Qué restricciones deben aplicarse en la base de datos?
- ¿Qué reglas permanecen en el dominio o capa de aplicación?
- ¿Qué operación requiere transacción?
- ¿Qué combinación de valores debe ser única?
- ¿Qué datos necesitan historial?`
    )
    .join("\n\n");
}

function renderTenancyAndOwnership(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const multiTenant = isMultiTenantCandidate(input);

  if (!multiTenant) {
    return `No existe evidencia suficiente para confirmar un modelo multi-tenant.

Antes de diseñar políticas de aislamiento se debe confirmar:

1. Si habrá más de una organización, cuenta o cliente.
2. Si los usuarios pueden pertenecer a varios espacios.
3. Si un recurso puede compartirse entre organizaciones.
4. Qué actor es propietario de cada registro.
5. Qué operaciones requieren permisos administrativos.`;
  }

  return `El proyecto presenta indicios de arquitectura multi-tenant.

Se recomienda que toda tabla de negocio tenga una ruta verificable hacia su organización o tenant propietario.

Patrones candidatos:

- Columna directa \`organization_id\` o \`tenant_id\`.
- Pertenencia indirecta mediante una entidad padre.
- Políticas Row Level Security cuando la base de datos lo soporte.
- Restricciones únicas compuestas por tenant.
- Índices que comiencen por el identificador del tenant en consultas frecuentes.
- Validaciones que impidan relaciones entre tenants.
- Auditoría de cambios de pertenencia.

Ejemplo conceptual:

\`\`\`sql
unique (organization_id, external_reference)
\`\`\`

La columna, tabla propietaria y estrategia de membresía deben confirmarse antes de implementar migraciones.`;
}

function renderSecurityRequirements(
  model: ProjectModel
): string {
  const securityRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "security"
    );

  if (securityRequirements.length === 0) {
    return renderEmptyState(
      "No se han definido requisitos de seguridad suficientes para aprobar el acceso a datos."
    );
  }

  return securityRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

${requirement.description}

- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

**Controles por definir:**

- Clasificación del dato.
- Roles con acceso.
- Operaciones permitidas.
- Cifrado requerido.
- Retención y eliminación.
- Auditoría.
- Enmascaramiento.
- Exportación.
- Restricciones regulatorias.`
    )
    .join("\n\n");
}

function renderIndexCandidates(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay tablas candidatas para proponer índices."
    );
  }

  const multiTenant = isMultiTenantCandidate({
    project,
    model,
  });

  return model.domainEntities
    .map((entity, index) => {
      const tableName =
        toSnakeCase(entity.name) || `entity_${index + 1}`;

      const tenantIndex = multiTenant
        ? `- Índice por \`organization_id\` o \`tenant_id\`.
- Índices compuestos que comiencen por el tenant cuando la consulta esté aislada por organización.`
        : "- Índice de pertenencia pendiente de confirmar.";

      return `### ${index + 1}. \`${tableName}\`

- Clave primaria sobre \`id\`.
${tenantIndex}
- Índice sobre claves foráneas.
- Índices para filtros y ordenamientos frecuentes.
- Restricciones únicas para identificadores de negocio.
- Evitar índices especulativos sin evidencia de consulta.

> Los índices definitivos deben decidirse a partir de consultas reales, cardinalidad y planes de ejecución.`;
    })
    .join("\n\n");
}

function renderLifecycleAndDeletion(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades suficientes para definir ciclos de vida."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. ${entity.name}

Debe confirmarse:

- Estado inicial.
- Estados válidos.
- Transiciones permitidas.
- Quién puede ejecutar cada transición.
- Si admite eliminación física.
- Si requiere eliminación lógica.
- Tiempo de retención.
- Dependencias que bloquean su eliminación.
- Necesidad de restauración.
- Eventos que deben auditarse.`
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

**Impacto potencial en datos:** puede modificar tablas, relaciones, restricciones, índices, políticas de acceso o estrategia de retención.`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos de datos registrados."
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

**Impacto potencial:** tablas, columnas, relaciones, restricciones, seguridad, retención o migraciones.`
    )
    .join("\n\n");
}

export function generateDataModelMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Data Model — ${project.name}

## 1. Estado del documento

- **Tipo:** Data Model
- **Estado:** Borrador conceptual generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este documento no representa todavía un esquema físico aprobado. Las entidades fueron detectadas desde la entrevista, pero faltan atributos, relaciones, cardinalidades, restricciones y patrones de consulta.

---

## 2. Contexto del producto

### Descripción

${project.description || "No hay descripción inicial disponible."}

### Objetivo principal

${project.mainGoal || "No definido."}

### Clasificación

- **Industria:** ${project.industry || "No definida"}
- **Tipo de producto:** ${project.productType}
- **Estado del proyecto:** ${project.status}

---

## 3. Principios de modelado

1. La base de datos debe proteger integridad, no funcionar únicamente como almacenamiento pasivo.
2. Cada dato debe tener un propietario lógico.
3. Las relaciones críticas deben usar claves foráneas cuando sea apropiado.
4. Las reglas únicas deben expresarse mediante restricciones reproducibles.
5. Los cambios de esquema deben versionarse mediante migraciones.
6. Los timestamps deben tener semántica clara.
7. La eliminación debe diseñarse explícitamente.
8. El aislamiento entre organizaciones debe aplicarse cerca de los datos cuando corresponda.
9. Los documentos y vistas derivadas no deben sustituir la fuente estructurada de verdad.
10. Los índices deben responder a patrones reales de consulta.

---

## 4. Inventario conceptual de entidades

${renderEntityInventory(model)}

---

## 5. Tablas candidatas

${renderCandidateTables({
  project,
  model,
})}

---

## 6. Relaciones pendientes

${renderRelationshipBacklog(model)}

---

## 7. Requisitos y restricciones de integridad

${renderIntegrityRequirements(model)}

---

## 8. Tenancy, pertenencia y propiedad

${renderTenancyAndOwnership({
  project,
  model,
})}

---

## 9. Seguridad por datos

${renderSecurityRequirements(model)}

---

## 10. Restricciones recomendadas

Para las tablas confirmadas se deben evaluar:

- \`primary key\`
- \`foreign key\`
- \`not null\`
- \`unique\`
- \`check\`
- Restricciones únicas compuestas.
- Validación de tenant o propietario.
- Reglas de eliminación.
- Valores predeterminados.
- Validaciones de rango.
- Validaciones de estado.

Las reglas críticas no deberían depender únicamente de validaciones de interfaz.

---

## 11. Índices candidatos

${renderIndexCandidates({
  project,
  model,
})}

---

## 12. Ciclo de vida, retención y eliminación

${renderLifecycleAndDeletion(model)}

---

## 13. Auditoría y trazabilidad

Las operaciones sensibles deberían registrar, cuando aplique:

- Actor.
- Organización o tenant.
- Recurso afectado.
- Acción.
- Estado anterior.
- Estado posterior.
- Fecha y hora.
- Origen de la operación.
- Identificador de correlación.
- Motivo o contexto.

No toda modificación necesita una copia completa del registro. La estrategia debe ajustarse al riesgo, cumplimiento y volumen.

---

## 14. Versionado

Debe distinguirse entre:

### Versionado de esquema

Migraciones inmutables y reproducibles que describen cambios estructurales.

### Versionado de datos

Historial de entidades cuando el negocio necesita reconstruir estados anteriores.

### Versionado de artefactos

Historial de documentos generados cuando una nueva generación no debe eliminar la versión previa.

Cada modalidad responde a necesidades diferentes y no debe implementarse automáticamente en todas las tablas.

---

## 15. Estrategia de migraciones

1. Crear una migración por cambio coherente.
2. No editar migraciones ya aplicadas en ambientes compartidos.
3. Incluir restricciones e índices necesarios.
4. Diseñar backfills para columnas nuevas.
5. Separar cambios destructivos cuando requieran transición.
6. Validar compatibilidad con código desplegado.
7. Probar rollback o estrategia de recuperación.
8. Mantener el esquema del repositorio alineado con la base remota.

---

## 16. Estrategia de respaldo y recuperación

Debe definirse:

- Frecuencia de respaldos.
- Retención.
- Restauración por ambiente.
- Objetivo de pérdida de datos.
- Objetivo de tiempo de recuperación.
- Verificación periódica de restauración.
- Protección de respaldos.
- Responsabilidad operacional.

---

## 17. Supuestos que afectan el modelo

${renderAssumptions(model)}

---

## 18. Riesgos de datos

${renderRisks(model)}

---

## 19. Preguntas abiertas

${renderOpenQuestions(model)}

---

## 20. Trabajo requerido antes del esquema físico

1. Confirmar todas las entidades.
2. Definir atributos y tipos conceptuales.
3. Definir identificadores naturales y técnicos.
4. Establecer relaciones y cardinalidades.
5. Definir ownership y tenancy.
6. Identificar invariantes.
7. Definir restricciones únicas.
8. Establecer ciclos de vida.
9. Diseñar eliminación y retención.
10. Confirmar datos sensibles.
11. Definir consultas principales.
12. Diseñar índices con evidencia.
13. Definir auditoría.
14. Crear migraciones.
15. Probar aislamiento, integridad y concurrencia.

---

## 21. Criterios de aprobación

El Data Model podrá considerarse aprobado cuando:

- Las entidades principales estén confirmadas.
- Los atributos obligatorios estén definidos.
- Las relaciones tengan cardinalidades claras.
- Las restricciones de integridad sean verificables.
- La estrategia multi-tenant esté definida cuando aplique.
- Los datos sensibles tengan controles explícitos.
- Los ciclos de vida estén documentados.
- Las consultas críticas tengan soporte adecuado.
- Las migraciones puedan ejecutarse de forma reproducible.
- Los riesgos de impacto alto tengan mitigación.

---

## 22. Nota de trazabilidad

Este modelo fue derivado del Foundation Project y del Project Model. Toda tabla, columna, relación o restricción futura debe mantener relación con una entidad, requisito, riesgo, supuesto o decisión documentada.
`;
}
