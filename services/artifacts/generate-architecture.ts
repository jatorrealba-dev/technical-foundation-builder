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

function renderArchitectureDrivers(
  model: ProjectModel
): string {
  const requirements = getActiveRequirements(model);

  if (requirements.length === 0) {
    return renderEmptyState(
      "No existen requisitos activos suficientes para establecer drivers arquitectónicos."
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

**Impacto arquitectónico pendiente:** determinar qué módulo, componente, flujo o restricción técnica será responsable de satisfacer este requisito.`
    )
    .join("\n\n");
}

function renderQualityAttributes(
  model: ProjectModel
): string {
  const qualityRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "non_functional" ||
        requirement.type === "security" ||
        requirement.type === "operational" ||
        requirement.type === "integration" ||
        requirement.type === "reporting"
    );

  if (qualityRequirements.length === 0) {
    return renderEmptyState(
      "No se han definido atributos de calidad explícitos. Deben confirmarse rendimiento, disponibilidad, seguridad, escalabilidad, observabilidad y mantenibilidad."
    );
  }

  const rows = qualityRequirements
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.title)} | ${requirement.type} | ${requirement.priority} | ${requirement.status} | ${escapeTableCell(requirement.description)} |`
    )
    .join("\n");

  return `| Atributo o restricción | Categoría | Prioridad | Estado | Definición inicial |
|---|---|---|---|---|
${rows}`;
}

function renderProposedModules(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades confirmadas suficientes para proponer módulos funcionales."
    );
  }

  return model.domainEntities
    .map(
      (entity, index) => `### ${index + 1}. Módulo candidato: ${entity.name}

**Responsabilidad inicial**

${entity.description}

- **Estado del concepto:** ${entity.status}
- **Fuente:** ${entity.sourceQuestionId ?? "No especificada"}
- **Persistencia:** pendiente de diseño.
- **Operaciones principales:** pendientes de definición.
- **Dependencias:** pendientes de análisis.
- **Reglas de autorización:** pendientes de confirmación.

> Este módulo es una propuesta preliminar derivada del dominio. No implica todavía una carpeta, servicio, microservicio o tabla específica.`
    )
    .join("\n\n");
}

function renderDataResponsibilities(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades suficientes para definir responsabilidades de datos."
    );
  }

  const rows = model.domainEntities
    .map(
      (entity) =>
        `| ${escapeTableCell(entity.name)} | Pendiente | Pendiente | Pendiente | ${entity.status} |`
    )
    .join("\n");

  return `| Concepto | Propietario del dato | Persistencia candidata | Clasificación de acceso | Estado |
|---|---|---|---|---|
${rows}

Cada dato deberá tener un único propietario lógico. Otros módulos deberían consumirlo mediante contratos explícitos en lugar de modificarlo directamente.`;
}

function renderSecurityConsiderations(
  model: ProjectModel
): string {
  const securityRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "security"
    );

  const highImpactAssumptions =
    model.assumptions.filter(
      (assumption) =>
        assumption.impact === "high"
    );

  const highImpactRisks = model.risks.filter(
    (risk) =>
      risk.impact === "high"
  );

  const sections: string[] = [];

  if (securityRequirements.length > 0) {
    sections.push(`### Requisitos de seguridad detectados

${securityRequirements
  .map(
    (requirement, index) => `${index + 1}. **${requirement.title}**
   - ${requirement.description}
   - Prioridad: ${requirement.priority}
   - Estado: ${requirement.status}`
  )
  .join("\n")}`);
  }

  if (highImpactAssumptions.length > 0) {
    sections.push(`### Supuestos de alto impacto

${highImpactAssumptions
  .map(
    (assumption, index) => `${index + 1}. ${assumption.statement}
   - Estado: ${assumption.status}`
  )
  .join("\n")}`);
  }

  if (highImpactRisks.length > 0) {
    sections.push(`### Riesgos de alto impacto

${highImpactRisks
  .map(
    (risk, index) => `${index + 1}. **${risk.title}**
   - ${risk.description}
   - Mitigación: ${risk.mitigation}`
  )
  .join("\n")}`);
  }

  if (sections.length === 0) {
    return renderEmptyState(
      "No hay requisitos explícitos suficientes para aprobar el diseño de seguridad."
    );
  }

  return sections.join("\n\n");
}

function renderIntegrations(
  model: ProjectModel
): string {
  const integrationRequirements =
    getActiveRequirements(model).filter(
      (requirement) =>
        requirement.type === "integration"
    );

  if (integrationRequirements.length === 0) {
    return renderEmptyState(
      "No se han identificado integraciones externas explícitas."
    );
  }

  return integrationRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

${requirement.description}

- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Contrato:** pendiente.
- **Autenticación:** pendiente.
- **Manejo de errores:** pendiente.
- **Reintentos e idempotencia:** pendientes.
- **Observabilidad:** pendiente.`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos arquitectónicos registrados."
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
      "No hay preguntas abiertas críticas para la arquitectura actual."
    );
  }

  return model.openQuestions
    .map(
      (item, index) => `### ${index + 1}. ${item.question}

- **Prioridad:** ${item.priority}
- **Razón:** ${item.reason}

**Decisión arquitectónica afectada:** componentes, persistencia, seguridad, despliegue, integración o escalabilidad.`
    )
    .join("\n\n");
}

function renderProductTypeGuidance(
  project: FoundationProject
): string {
  switch (project.productType) {
    case "web_app":
      return `La solución fue clasificada como aplicación web. La arquitectura candidata debe separar claramente interfaz, lógica de aplicación, dominio y persistencia, manteniendo renderizado y operaciones sensibles en el servidor cuando sea apropiado.`;

    case "mobile_app":
      return `La solución fue clasificada como aplicación móvil. Debe definirse un cliente móvil y un backend autorizado como fuente de verdad, incluyendo sincronización, conectividad intermitente y almacenamiento local seguro cuando corresponda.`;

    case "saas":
      return `La solución fue clasificada como SaaS. Debe contemplar identidad, organizaciones o tenants, aislamiento de datos, autorización por membresía, auditoría y límites de consumo desde el diseño inicial.`;

    case "internal_system":
      return `La solución fue clasificada como sistema interno. Debe priorizar integración con identidad corporativa, control de acceso por funciones, auditoría y compatibilidad con los procesos operativos existentes.`;

    case "marketplace":
      return `La solución fue clasificada como marketplace. Debe separar participantes, catálogo u oferta, transacciones, reglas de intermediación, pagos y resolución de disputas.`;

    case "ecommerce":
      return `La solución fue clasificada como ecommerce. Debe separar catálogo, inventario, carrito, pedidos, pagos, cumplimiento y devoluciones, conservando consistencia en operaciones críticas.`;

    case "ai_tool":
      return `La solución fue clasificada como herramienta de IA. Debe separar orquestación, contexto, proveedores de modelos, validación estructurada, trazabilidad, evaluación, control de costos y revisión humana.`;

    default:
      return `El tipo de producto requiere mayor definición antes de aprobar una topología arquitectónica específica.`;
  }
}

export function generateArchitectureMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Architecture — ${project.name}

## 1. Estado del documento

- **Tipo:** Software Architecture
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Esta arquitectura es una propuesta inicial. No debe interpretarse como aprobación definitiva de tecnologías, infraestructura, límites de módulos o estrategia de despliegue.

---

## 2. Resumen del producto

${project.description || "No hay descripción inicial disponible."}

### Objetivo principal

${project.mainGoal || "No definido."}

### Clasificación

- **Industria:** ${project.industry || "No definida"}
- **Tipo de producto:** ${project.productType}
- **Estado del proyecto:** ${project.status}

---

## 3. Orientación derivada del tipo de producto

${renderProductTypeGuidance(project)}

---

## 4. Estilo arquitectónico inicial propuesto

Se recomienda comenzar con un **monolito modular**, salvo que requisitos confirmados demuestren la necesidad de otra topología.

El monolito modular deberá:

- Mantener límites funcionales explícitos.
- Separar UI, aplicación, dominio e infraestructura.
- Evitar dependencias circulares.
- Centralizar autenticación y autorización.
- Usar una fuente de verdad transaccional.
- Exponer contratos internos claros.
- Permitir pruebas por módulo.
- Facilitar una futura extracción de servicios sin exigirla desde el inicio.

No se recomiendan microservicios inicialmente sin evidencia de:

- Equipos autónomos independientes.
- Necesidades de escalado claramente diferentes.
- Requisitos de aislamiento operacional.
- Límites de dominio suficientemente maduros.
- Costos de coordinación justificables.

---

## 5. Drivers arquitectónicos

${renderArchitectureDrivers(model)}

---

## 6. Atributos de calidad y restricciones

${renderQualityAttributes(model)}

---

## 7. Capas propuestas

### 7.1. Interfaz

Responsable de:

- Presentación.
- Captura y validación inicial de entrada.
- Navegación.
- Estados de carga y error.
- Accesibilidad.
- Adaptación a los canales requeridos.

### 7.2. Aplicación

Responsable de:

- Casos de uso.
- Coordinación de operaciones.
- Transacciones.
- Autorización de acciones.
- Orquestación entre dominio e infraestructura.
- Idempotencia en operaciones críticas.

### 7.3. Dominio

Responsable de:

- Entidades.
- Value objects.
- Reglas de negocio.
- Invariantes.
- Servicios de dominio.
- Eventos de dominio cuando sean necesarios.

### 7.4. Infraestructura

Responsable de:

- Persistencia.
- Proveedores externos.
- Mensajería.
- Archivos.
- Observabilidad.
- Integraciones.
- Configuración de despliegue.

---

## 8. Módulos funcionales candidatos

${renderProposedModules(model)}

---

## 9. Fuente de verdad y responsabilidades de datos

Se recomienda utilizar una fuente de verdad transaccional para los datos estructurados del producto.

Los documentos, vistas materializadas, índices de búsqueda y salidas generadas deberán tratarse como derivados cuando puedan reconstruirse desde el modelo persistido.

${renderDataResponsibilities(model)}

---

## 10. Autenticación, autorización y seguridad

La arquitectura debe diferenciar:

- **Autenticación:** quién es el actor.
- **Autorización:** qué acciones puede realizar.
- **Tenancy o pertenencia:** sobre qué organización, cuenta o espacio opera.
- **Propiedad:** qué recursos controla directamente.
- **Auditoría:** qué acciones sensibles deben registrarse.

${renderSecurityConsiderations(model)}

---

## 11. Integraciones externas

${renderIntegrations(model)}

---

## 12. Contratos internos

Los módulos deberían comunicarse mediante contratos explícitos:

- Tipos de entrada y salida.
- Errores esperados.
- Reglas de autorización.
- Responsabilidad transaccional.
- Comportamiento idempotente.
- Eventos emitidos.
- Dependencias permitidas.

No se debe permitir que componentes de presentación modifiquen directamente la persistencia sin atravesar un caso de uso autorizado.

---

## 13. Persistencia

La persistencia definitiva debe diseñarse después de confirmar el Domain Model.

Principios iniciales:

1. Mantener identificadores estables.
2. Aplicar restricciones de integridad en la base de datos.
3. Definir claves únicas para operaciones idempotentes.
4. Mantener timestamps de creación y actualización.
5. Evitar duplicar datos sin una estrategia de sincronización.
6. Aplicar políticas de acceso cercanas a los datos cuando sea posible.
7. Versionar cambios mediante migraciones reproducibles.
8. Documentar retención, respaldo y eliminación.

---

## 14. Observabilidad

La primera versión desplegable debería incluir:

- Logs estructurados.
- Registro de errores.
- Identificador de correlación para operaciones importantes.
- Métricas básicas de disponibilidad y latencia.
- Seguimiento de operaciones fallidas.
- Auditoría de acciones sensibles.
- Alertas para errores críticos.

No deben registrarse credenciales, tokens ni datos sensibles sin protección.

---

## 15. Estrategia de pruebas

La arquitectura debe permitir:

- Pruebas unitarias del dominio.
- Pruebas de casos de uso.
- Pruebas de integración con persistencia.
- Pruebas de autorización y aislamiento.
- Pruebas de contratos externos.
- Pruebas end-to-end de los flujos principales.
- Pruebas de regresión para operaciones críticas.

---

## 16. Despliegue inicial

La primera estrategia de despliegue debería priorizar:

- Un solo pipeline reproducible.
- Ambientes separados.
- Variables secretas gestionadas fuera del repositorio.
- Migraciones controladas.
- Verificación automática mediante lint, tipos, pruebas y build.
- Capacidad de rollback.
- Copias de seguridad cuando existan datos persistentes.

La plataforma concreta permanece pendiente hasta confirmar restricciones de operación, región, costos y cumplimiento.

---

## 17. Evolución arquitectónica

La arquitectura deberá evolucionar mediante evidencia.

Una separación en servicios podrá evaluarse cuando exista:

- Un límite de dominio estable.
- Una carga o disponibilidad diferenciada.
- Un equipo responsable independiente.
- Necesidad real de despliegue autónomo.
- Justificación operacional y económica.

Hasta entonces, los límites deben expresarse primero como módulos internos.

---

## 18. Riesgos arquitectónicos

${renderRisks(model)}

---

## 19. Preguntas abiertas

${renderOpenQuestions(model)}

---

## 20. Decisiones pendientes

Antes de aprobar esta arquitectura se debe confirmar:

1. Canales de acceso requeridos.
2. Volumen esperado y patrones de carga.
3. Disponibilidad y recuperación requeridas.
4. Modelo de identidad y autorización.
5. Necesidades multi-tenant.
6. Datos sensibles y obligaciones regulatorias.
7. Integraciones externas.
8. Requisitos de conectividad u operación offline.
9. Estrategia de almacenamiento de archivos.
10. Requisitos de auditoría.
11. Regiones y restricciones de despliegue.
12. Presupuesto operacional.
13. Objetivos de rendimiento.
14. Estrategia de pruebas.
15. Responsables de soporte y operación.

---

## 21. Criterios de aprobación

La arquitectura podrá considerarse aprobada cuando:

- Los drivers principales estén confirmados.
- Los límites funcionales sean comprensibles.
- Los requisitos obligatorios tengan un responsable técnico.
- La seguridad y autorización estén definidas.
- La persistencia conserve integridad y aislamiento.
- Los riesgos de impacto alto tengan mitigación.
- Las preguntas de prioridad alta estén resueltas.
- La estrategia pueda probarse y desplegarse.
- Las decisiones relevantes estén documentadas.

---

## 22. Nota de trazabilidad

Esta propuesta fue derivada del Foundation Project y del Project Model. Toda decisión arquitectónica futura debe mantener relación con requisitos, riesgos, supuestos o preguntas de origen.
`;
}
