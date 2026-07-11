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

function buildSearchableText(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return [
    project.name,
    project.description,
    project.mainGoal,
    project.industry,
    project.productType,
    ...model.requirements.map(
      (requirement) =>
        `${requirement.title} ${requirement.description}`
    ),
    ...model.assumptions.map(
      (assumption) => assumption.statement
    ),
    ...model.domainEntities.map(
      (entity) =>
        `${entity.name} ${entity.description}`
    ),
    ...model.risks.map(
      (risk) =>
        `${risk.title} ${risk.description} ${risk.mitigation}`
    ),
    ...model.openQuestions.map(
      (item) =>
        `${item.question} ${item.reason}`
    ),
  ]
    .join(" ")
    .toLowerCase();
}

function isMultiTenantCandidate(input: {
  project: FoundationProject;
  model: ProjectModel;
}): boolean {
  const searchableText = buildSearchableText(input);

  return (
    input.project.productType === "saas" ||
    searchableText.includes("multi-tenant") ||
    searchableText.includes("multitenant") ||
    searchableText.includes("tenant") ||
    searchableText.includes("organización") ||
    searchableText.includes("organizaciones") ||
    searchableText.includes("empresa") ||
    searchableText.includes("empresas")
  );
}

function isAiCandidate(input: {
  project: FoundationProject;
  model: ProjectModel;
}): boolean {
  const searchableText = buildSearchableText(input);

  return (
    input.project.productType === "ai_tool" ||
    searchableText.includes("inteligencia artificial") ||
    searchableText.includes("modelo de lenguaje") ||
    searchableText.includes("machine learning") ||
    searchableText.includes("openai") ||
    searchableText.includes("agente") ||
    searchableText.includes("prompt")
  );
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
      "No se han definido requisitos de seguridad explícitos. La arquitectura no debe considerarse aprobada hasta confirmar autenticación, autorización, privacidad, auditoría y protección de datos."
    );
  }

  return securityRequirements
    .map(
      (requirement, index) => `### ${index + 1}. ${requirement.title}

- **Prioridad:** ${requirement.priority}
- **Estado:** ${requirement.status}
- **Fuente:** ${requirement.sourceQuestionId ?? "No especificada"}

${requirement.description}

**Controles pendientes de definición:**

- Actor o sistema responsable.
- Recursos protegidos.
- Operaciones permitidas.
- Validación del lado servidor.
- Registro de auditoría.
- Pruebas de seguridad.
- Criterios verificables de aceptación.`
    )
    .join("\n\n");
}

function renderAuthenticationGuidance(
  project: FoundationProject
): string {
  switch (project.productType) {
    case "saas":
      return `El producto fue clasificado como SaaS. Es probable que necesite identidad persistente, sesiones seguras, recuperación de cuenta y pertenencia a organizaciones o tenants.

No se ha confirmado todavía un proveedor de identidad.`;

    case "internal_system":
      return `El producto fue clasificado como sistema interno. Debe evaluarse integración con el proveedor de identidad corporativo, inicio de sesión único y políticas organizacionales de acceso.

No debe crearse un sistema de contraseñas independiente sin evaluar primero la identidad existente.`;

    case "mobile_app":
      return `El producto fue clasificado como aplicación móvil. Las credenciales y tokens deben almacenarse mediante mecanismos seguros del sistema operativo. El backend debe validar cada operación sensible.

La aplicación cliente no debe considerarse un entorno confiable.`;

    case "marketplace":
    case "ecommerce":
      return `El producto maneja potencialmente cuentas, operaciones comerciales y actores con capacidades diferentes. Debe contemplar protección contra apropiación de cuentas, sesiones robadas y automatización abusiva.

La identidad de compradores, vendedores, operadores y administradores debe diferenciarse explícitamente.`;

    case "ai_tool":
      return `El producto fue clasificado como herramienta de IA. La identidad del usuario debe mantenerse separada de las credenciales utilizadas para invocar proveedores de modelos.

Las claves de proveedores nunca deben exponerse al cliente.`;

    default:
      return `No existe información suficiente para aprobar un mecanismo específico de autenticación.

Debe confirmarse si el producto requiere usuarios registrados, acceso anónimo, cuentas corporativas, autenticación multifactor o integración con un proveedor externo.`;
  }
}

function renderAuthorizationGuidance(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const multiTenant = isMultiTenantCandidate(input);

  if (multiTenant) {
    return `El proyecto presenta indicios de multi-tenancy.

El modelo de autorización debería evaluar:

- Organizaciones o tenants.
- Membresías.
- Roles.
- Permisos explícitos.
- Propiedad de recursos.
- Acceso por proyecto, espacio o equipo.
- Acciones administrativas.
- Recursos compartidos.
- Separación entre lectura, creación, edición, aprobación y eliminación.
- Restricciones aplicadas cerca de la fuente de datos.

Regla candidata:

> Un actor solo puede operar sobre un recurso cuando tiene una relación válida con el tenant propietario y el permiso requerido para la acción.

Esta regla debe implementarse y probarse en el servidor y, cuando la plataforma de datos lo permita, reforzarse mediante políticas de acceso a nivel de fila.`;
  }

  return `No se ha confirmado un modelo multi-tenant.

La autorización debe diseñarse mediante capacidades verificables, no solamente ocultando elementos en la interfaz.

Debe definirse:

- Qué actores existen.
- Qué roles o permisos necesita cada actor.
- Quién es propietario de cada recurso.
- Qué operaciones son públicas.
- Qué operaciones requieren autenticación.
- Qué operaciones requieren privilegios elevados.
- Qué validaciones deben aplicarse en el servidor.`;
}

function renderDataClassification(
  model: ProjectModel
): string {
  if (model.domainEntities.length === 0) {
    return renderEmptyState(
      "No hay entidades suficientes para clasificar los datos."
    );
  }

  const rows = model.domainEntities
    .map(
      (entity) =>
        `| ${escapeTableCell(entity.name)} | Pendiente | Pendiente | Pendiente | ${entity.status} |`
    )
    .join("\n");

  return `| Entidad | Clasificación | Datos personales | Nivel de acceso | Estado |
|---|---|---|---|---|
${rows}

Clasificaciones candidatas:

- **Público:** información que puede divulgarse sin autorización.
- **Interno:** información operacional no destinada al público.
- **Confidencial:** información comercial, técnica o personal con acceso limitado.
- **Restringido:** credenciales, secretos, datos regulados o información de alto impacto.

La clasificación definitiva debe definirse por campo, no únicamente por tabla o entidad.`;
}

function renderThreatModel(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project } = input;
  const threats: string[] = [
    `### 1. Acceso no autorizado

**Escenario:** un actor intenta leer o modificar recursos sin el permiso requerido.

**Controles candidatos:**

- Validación de sesión en el servidor.
- Autorización por operación.
- Denegación por defecto.
- Pruebas negativas.
- Auditoría de acciones sensibles.`,

    `### 2. Manipulación de identificadores

**Escenario:** un usuario cambia un identificador enviado por el cliente para acceder a un recurso ajeno.

**Controles candidatos:**

- No confiar en identificadores del cliente como prueba de autorización.
- Verificar propiedad, pertenencia o permiso en cada operación.
- Utilizar consultas restringidas por actor o tenant.
- Probar acceso horizontal y vertical.`,

    `### 3. Exposición de secretos

**Escenario:** claves, tokens o credenciales aparecen en el cliente, repositorio, logs o mensajes de error.

**Controles candidatos:**

- Secretos únicamente en entornos autorizados del servidor.
- Variables fuera del repositorio.
- Rotación de credenciales.
- Redacción de logs.
- Análisis automático de secretos.`,

    `### 4. Entrada maliciosa

**Escenario:** contenido introducido por usuarios altera consultas, HTML, comandos, archivos o integraciones.

**Controles candidatos:**

- Validación de esquemas.
- Consultas parametrizadas.
- Codificación de salida.
- Restricción de tipos y tamaños.
- Sanitización contextual.
- Rechazo de formatos inesperados.`,

    `### 5. Abuso de operaciones

**Escenario:** un actor legítimo automatiza o repite acciones para consumir recursos, duplicar operaciones o provocar efectos inconsistentes.

**Controles candidatos:**

- Rate limiting.
- Idempotencia.
- Límites por cuenta o tenant.
- Protección contra reintentos duplicados.
- Monitoreo de patrones anómalos.`,
  ];

  if (
    project.productType === "ecommerce" ||
    project.productType === "marketplace"
  ) {
    threats.push(`### ${threats.length + 1}. Manipulación de transacciones

**Escenario:** importes, estados, inventario, comisiones o referencias de pago son alterados desde el cliente.

**Controles candidatos:**

- Calcular valores críticos en el servidor.
- Verificar firmas de webhooks.
- Aplicar idempotencia.
- Mantener estados transaccionales válidos.
- Auditar cambios financieros.
- No confiar en confirmaciones del cliente.`);
  }

  if (project.productType === "mobile_app") {
    threats.push(`### ${threats.length + 1}. Cliente móvil comprometido

**Escenario:** la aplicación es inspeccionada, modificada o ejecutada en un dispositivo no confiable.

**Controles candidatos:**

- No almacenar secretos permanentes en el paquete.
- Validar toda autorización en el backend.
- Proteger tokens mediante almacenamiento seguro.
- Evitar confiar en validaciones exclusivamente locales.
- Limitar información sensible en caché.`);
  }

  if (isMultiTenantCandidate(input)) {
    threats.push(`### ${threats.length + 1}. Acceso cruzado entre tenants

**Escenario:** un usuario obtiene información perteneciente a otra organización.

**Controles candidatos:**

- Identificador de tenant verificable.
- Restricciones de pertenencia.
- Políticas de acceso a nivel de datos.
- Claves únicas compuestas por tenant.
- Pruebas automatizadas de aislamiento.
- Prohibición de relaciones cruzadas no autorizadas.`);
  }

  if (isAiCandidate(input)) {
    threats.push(`### ${threats.length + 1}. Inyección de instrucciones en contenido

**Escenario:** datos proporcionados por usuarios o fuentes externas intentan modificar las instrucciones de un modelo o agente.

**Controles candidatos:**

- Separar instrucciones y datos.
- Tratar el contenido recuperado como no confiable.
- Validar salidas mediante esquemas.
- Limitar herramientas y permisos.
- Requerir aprobación humana para acciones críticas.
- Registrar trazas sin exponer datos sensibles.`);
  }

  return threats.join("\n\n");
}

function renderAiSecurity(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  if (!isAiCandidate(input)) {
    return `No existe evidencia suficiente para confirmar que el producto utilizará inteligencia artificial.

Si posteriormente se incorporan modelos o agentes, esta sección deberá revisarse antes de habilitar acciones sobre datos o sistemas externos.`;
  }

  return `El proyecto presenta indicios de uso de inteligencia artificial.

Controles recomendados:

1. Separar instrucciones del sistema, contexto del proyecto y contenido del usuario.
2. Validar toda salida estructurada mediante esquemas.
3. No permitir que el modelo determine por sí solo la autorización.
4. No exponer secretos dentro del contexto.
5. Aplicar mínimo privilegio a herramientas y conectores.
6. Registrar proveedor, modelo, versión y propósito de cada ejecución.
7. Mantener trazabilidad entre entrada, salida y decisión humana.
8. Proteger contra reutilización de información entre usuarios o tenants.
9. Establecer límites de costo, tiempo y volumen.
10. Evaluar alucinaciones, inyección de instrucciones y fuga de datos.
11. Requerir revisión humana para decisiones críticas.
12. Permitir invalidar o regenerar resultados derivados.

La salida de un modelo debe tratarse como propuesta hasta ser validada por reglas, fuentes confiables o una persona autorizada.`;
}

function renderIntegrationSecurity(
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

**Controles pendientes:**

- Método de autenticación.
- Almacenamiento y rotación de credenciales.
- Validación de firmas.
- Restricción de permisos.
- Protección contra replay.
- Idempotencia.
- Timeouts.
- Reintentos.
- Validación de payloads.
- Auditoría.
- Manejo de indisponibilidad.
- Eliminación de datos compartidos.`
    )
    .join("\n\n");
}

function renderAuditCandidates(
  model: ProjectModel
): string {
  const activeRequirements =
    getActiveRequirements(model);

  const rows = activeRequirements
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.title)} | ${requirement.type} | ${requirement.priority} | Pendiente |`
    )
    .join("\n");

  if (!rows) {
    return renderEmptyState(
      "No existen operaciones suficientes para derivar eventos de auditoría."
    );
  }

  return `| Operación o capacidad | Tipo | Prioridad | Auditoría requerida |
|---|---|---|---|
${rows}

Todo evento de auditoría debería evaluar:

- Actor.
- Tenant u organización.
- Acción.
- Recurso.
- Identificador del recurso.
- Fecha y hora.
- Resultado.
- Motivo.
- Origen.
- Identificador de correlación.

Los logs de auditoría no deben almacenar secretos ni datos sensibles innecesarios.`;
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

**Impacto de seguridad:** este supuesto puede cambiar el modelo de amenazas, los permisos, la protección de datos o los controles requeridos.`
    )
    .join("\n\n");
}

function renderRisks(model: ProjectModel): string {
  if (model.risks.length === 0) {
    return renderEmptyState(
      "No hay riesgos registrados."
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
      "No hay preguntas abiertas registradas."
    );
  }

  return model.openQuestions
    .map(
      (item, index) => `### ${index + 1}. ${item.question}

- **Prioridad:** ${item.priority}
- **Razón:** ${item.reason}

**Impacto de seguridad potencial:** identidad, permisos, aislamiento, privacidad, auditoría, integraciones o cumplimiento.`
    )
    .join("\n\n");
}

function renderProductSpecificControls(
  project: FoundationProject
): string {
  switch (project.productType) {
    case "web_app":
      return `- Protección contra XSS.
- Protección contra CSRF cuando la estrategia de sesión lo requiera.
- Cookies seguras, HttpOnly y SameSite cuando corresponda.
- Encabezados de seguridad.
- Validación de operaciones en el servidor.
- Política de contenido.
- Dependencias del cliente controladas.`;

    case "mobile_app":
      return `- Almacenamiento seguro de tokens.
- Protección de datos locales.
- Comunicación cifrada.
- Validación de backend.
- Manejo de sesiones revocadas.
- Minimización de información en caché.
- Evaluación de deep links y enlaces universales.`;

    case "saas":
      return `- Aislamiento entre tenants.
- Roles y permisos.
- Auditoría administrativa.
- Límites de consumo.
- Exportación controlada.
- Eliminación por organización.
- Pruebas de acceso cruzado.`;

    case "internal_system":
      return `- Integración con identidad corporativa.
- Mínimo privilegio.
- Separación de funciones.
- Auditoría operacional.
- Restricción de redes cuando sea necesaria.
- Gestión de cuentas inactivas.
- Revisión periódica de permisos.`;

    case "marketplace":
      return `- Separación entre compradores, vendedores y operadores.
- Protección de cuentas.
- Validación de pagos y webhooks.
- Prevención de fraude.
- Auditoría de disputas.
- Protección de información entre participantes.
- Moderación y abuso.`;

    case "ecommerce":
      return `- Integridad de precios, inventario y pedidos.
- Validación de pagos.
- Protección de información del cliente.
- Prevención de fraude.
- Idempotencia.
- Auditoría de reembolsos.
- Restricción de acceso administrativo.`;

    case "ai_tool":
      return `- Aislamiento de contexto.
- Protección contra prompt injection.
- Validación de salidas.
- Restricción de herramientas.
- Control de costos.
- Trazabilidad.
- Revisión humana.
- Protección de credenciales de proveedores.`;

    default:
      return `- Autenticación según riesgo.
- Autorización en el servidor.
- Validación de entrada.
- Protección de secretos.
- Auditoría.
- Gestión de errores.
- Actualización de dependencias.`;
  }
}

export function generateSecurityMarkdown(input: {
  project: FoundationProject;
  model: ProjectModel;
}): string {
  const { project, model } = input;

  return `# Security — ${project.name}

## 1. Estado del documento

- **Tipo:** Security
- **Estado:** Borrador generado desde el Project Model
- **Proyecto:** ${project.name}
- **Project ID:** ${project.id}
- **Fecha de generación:** ${formatDate(model.generatedAt)}
- **Última actualización del modelo:** ${formatDate(model.updatedAt)}

> Este documento presenta requisitos detectados y controles candidatos. No constituye una certificación de seguridad, privacidad o cumplimiento normativo.

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

## 3. Principios de seguridad

1. Denegar acceso por defecto.
2. Aplicar mínimo privilegio.
3. No confiar en el cliente.
4. Validar autorización en cada operación sensible.
5. Mantener secretos fuera del código y del cliente.
6. Separar autenticación de autorización.
7. Proteger integridad y confidencialidad de los datos.
8. Registrar acciones críticas sin exponer información sensible.
9. Diseñar aislamiento entre usuarios, organizaciones o tenants.
10. Tratar entradas y contenido externo como no confiables.
11. Mantener dependencias y configuraciones reproducibles.
12. Requerir aprobación humana para decisiones críticas automatizadas.

---

## 4. Requisitos de seguridad detectados

${renderSecurityRequirements(model)}

---

## 5. Autenticación

${renderAuthenticationGuidance(project)}

Debe confirmarse:

- Tipos de usuario.
- Método de autenticación.
- Duración de sesión.
- Renovación y revocación.
- Recuperación de cuenta.
- Verificación de correo o teléfono.
- Autenticación multifactor.
- Protección contra fuerza bruta.
- Manejo de cuentas bloqueadas.
- Integración con identidad externa.

---

## 6. Autorización

${renderAuthorizationGuidance({
  project,
  model,
})}

---

## 7. Clasificación y protección de datos

${renderDataClassification(model)}

---

## 8. Modelo inicial de amenazas

${renderThreatModel({
  project,
  model,
})}

---

## 9. Seguridad de inteligencia artificial

${renderAiSecurity({
  project,
  model,
})}

---

## 10. Seguridad de integraciones

${renderIntegrationSecurity(model)}

---

## 11. Secretos y configuración

Los secretos deben:

- Existir únicamente en entornos autorizados.
- Mantenerse fuera del repositorio.
- No enviarse al navegador o aplicación cliente.
- Tener permisos mínimos.
- Rotarse cuando exista exposición o cambio de responsable.
- Diferenciarse por ambiente.
- Eliminarse de logs, errores y trazas.
- Gestionarse mediante un sistema apropiado de secretos.

Ejemplos de información que no debe exponerse:

- Claves privadas.
- Tokens administrativos.
- Credenciales de base de datos.
- Claves de proveedores.
- Secretos de webhooks.
- Tokens de sesión.
- Cadenas de conexión privilegiadas.

---

## 12. Validación de entradas y salidas

Toda entrada externa debe validarse por:

- Tipo.
- Longitud.
- Formato.
- Rango.
- Estado permitido.
- Relación con el actor.
- Tamaño máximo.
- Contenido esperado.

Toda salida debe codificarse según su contexto:

- HTML.
- URL.
- SQL.
- Shell.
- JSON.
- Markdown.
- Archivos descargables.
- Contenido enviado a proveedores externos.

---

## 13. Archivos y almacenamiento

Si el producto maneja archivos, debe definirse:

- Tipos permitidos.
- Tamaño máximo.
- Inspección del contenido.
- Nombres seguros.
- Ubicación privada o pública.
- Autorización de carga y descarga.
- URLs temporales.
- Retención.
- Eliminación.
- Protección contra ejecución.
- Auditoría.

La extensión del archivo no debe considerarse evidencia suficiente de su tipo real.

---

## 14. Auditoría

${renderAuditCandidates(model)}

---

## 15. Logging y observabilidad

Los logs deberían permitir detectar:

- Fallos de autenticación.
- Accesos denegados.
- Operaciones administrativas.
- Errores de autorización.
- Cambios de permisos.
- Actividad anómala.
- Fallos repetidos de integraciones.
- Operaciones críticas incompletas.

No deberían registrar:

- Contraseñas.
- Tokens completos.
- Claves.
- Datos personales innecesarios.
- Contenido confidencial completo.
- Credenciales de proveedores.

---

## 16. Manejo de errores

Los errores enviados al usuario deben:

- Ser comprensibles.
- No revelar consultas internas.
- No revelar estructura sensible.
- No incluir secretos.
- No exponer trazas del servidor.
- Mantener un identificador de correlación cuando sea útil.

El servidor puede conservar detalles técnicos en sistemas protegidos de observabilidad.

---

## 17. Dependencias y cadena de suministro

Se recomienda:

- Mantener lockfile.
- Revisar dependencias directas.
- Ejecutar análisis de vulnerabilidades.
- Evitar paquetes sin mantenimiento.
- Limitar scripts de instalación.
- Proteger ramas principales.
- Exigir revisión de cambios sensibles.
- Firmar o verificar artefactos cuando el riesgo lo justifique.
- Actualizar dependencias mediante cambios pequeños y verificables.

---

## 18. Controles específicos por tipo de producto

${renderProductSpecificControls(project)}

---

## 19. Privacidad y retención

Debe confirmarse:

- Qué datos personales se recopilan.
- Base y propósito de la recopilación.
- Tiempo de retención.
- Procedimiento de eliminación.
- Exportación de datos.
- Corrección de información.
- Proveedores que reciben datos.
- Regiones de procesamiento.
- Política de respaldos.
- Datos contenidos en logs.
- Datos utilizados por servicios de inteligencia artificial.

No debe afirmarse cumplimiento regulatorio sin revisión especializada y evidencia verificable.

---

## 20. Respuesta a incidentes

El producto debería definir:

1. Cómo detectar un incidente.
2. Quién recibe la alerta.
3. Cómo contener el acceso.
4. Cómo revocar credenciales.
5. Cómo preservar evidencia.
6. Cómo evaluar datos afectados.
7. Cómo restaurar la operación.
8. Cómo comunicar el incidente.
9. Cómo documentar causas.
10. Cómo verificar la mitigación.

---

## 21. Estrategia de pruebas de seguridad

La cobertura debería incluir:

- Acceso sin autenticación.
- Acceso con usuario incorrecto.
- Acceso cruzado entre recursos.
- Escalamiento de privilegios.
- Manipulación de identificadores.
- Entradas inválidas.
- Carga de archivos maliciosos cuando aplique.
- Repetición de operaciones.
- Revocación de sesión.
- Restricción de acciones administrativas.
- Aislamiento entre tenants.
- Exposición accidental de secretos.
- Validación de webhooks e integraciones.
- Pruebas de regresión de políticas de acceso.

---

## 22. Supuestos que afectan la seguridad

${renderAssumptions(model)}

---

## 23. Riesgos

${renderRisks(model)}

---

## 24. Preguntas abiertas

${renderOpenQuestions(model)}

---

## 25. Requisitos mínimos antes de producción

- Autenticación definida y probada.
- Autorización aplicada en el servidor.
- Aislamiento validado cuando corresponda.
- Secretos fuera del cliente y repositorio.
- Datos sensibles clasificados.
- Validación de entradas.
- Manejo seguro de errores.
- Logs sin secretos.
- Dependencias revisadas.
- Respaldos definidos.
- Operaciones críticas auditadas.
- Integraciones autenticadas.
- Pruebas negativas de permisos.
- Procedimiento básico de incidentes.

---

## 26. Criterios de aprobación

La estrategia de seguridad podrá aprobarse cuando:

- Los actores estén identificados.
- Los permisos sean explícitos.
- Los recursos tengan propietario.
- Los datos sensibles estén clasificados.
- Las amenazas principales tengan controles.
- Las integraciones tengan autenticación y validación.
- Los secretos tengan estrategia de gestión.
- Los riesgos de alto impacto tengan mitigación.
- Las preguntas críticas estén resueltas.
- Los controles puedan probarse automáticamente o mediante revisión verificable.

---

## 27. Nota de trazabilidad

Este documento fue derivado del Foundation Project y del Project Model. Todo control futuro debe mantener relación con un requisito, riesgo, supuesto, entidad, amenaza o decisión documentada.
`;
}
