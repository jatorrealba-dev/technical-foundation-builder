export const discoveryV2CoverageKeys = [
  "problem",
  "goals",
  "users",
  "roles",
  "workflow",
  "domain",
  "data",
  "integrations",
  "security",
  "operations",
  "constraints",
  "success_metrics",
  "delivery",
] as const;

export type DiscoveryV2CoverageKey =
  (typeof discoveryV2CoverageKeys)[number];

export const discoveryV2CoverageStatuses = [
  "missing",
  "partial",
  "complete",
  "not_applicable",
] as const;

export type DiscoveryV2CoverageStatus =
  (typeof discoveryV2CoverageStatuses)[number];

export const discoveryV2KnowledgeTypes = [
  "fact",
  "decision",
  "requirement",
  "constraint",
  "preference",
  "assumption",
  "risk",
  "open_question",
  "out_of_scope",
  "future_scope",
] as const;

export type DiscoveryV2KnowledgeType =
  (typeof discoveryV2KnowledgeTypes)[number];

export const discoveryV2KnowledgeValidationStatuses = [
  "proposed",
  "confirmed",
  "rejected",
  "superseded",
] as const;

export type DiscoveryV2KnowledgeValidationStatus =
  (typeof discoveryV2KnowledgeValidationStatuses)[number];

export const discoveryV2SessionStatuses = [
  "not_started",
  "in_progress",
  "ready_for_review",
  "completed",
  "completed_with_open_items",
  "abandoned",
] as const;

export type DiscoveryV2SessionStatus =
  (typeof discoveryV2SessionStatuses)[number];

export const discoveryV2IssueSeverities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type DiscoveryV2IssueSeverity =
  (typeof discoveryV2IssueSeverities)[number];

export const discoveryV2ArtifactTypes = [
  "product_spec",
  "mvp_scope",
  "domain_model",
  "architecture",
  "data_model",
  "security",
  "backlog",
  "vertical_slice_plan",
] as const;

export type DiscoveryV2ArtifactType =
  (typeof discoveryV2ArtifactTypes)[number];

export const discoveryV2ArtifactReadinessStatuses = [
  "blocked",
  "insufficient",
  "usable",
  "ready",
] as const;

export type DiscoveryV2ArtifactReadinessStatus =
  (typeof discoveryV2ArtifactReadinessStatuses)[number];

export const DISCOVERY_V2_SOFT_TURN_LIMIT = 30;
export const DISCOVERY_V2_HARD_TURN_LIMIT = 60;

export type DiscoveryV2EvidenceCriterion = {
  key: string;
  label: string;
};

export const discoveryV2EvidenceCriteria = {
  problem: [
    { key: "current_state", label: "Situación actual" },
    { key: "affected_party", label: "Persona o grupo afectado" },
    { key: "consequence", label: "Consecuencia del problema" },
    { key: "frequency_context", label: "Frecuencia o contexto" },
    { key: "motivation", label: "Razón para resolverlo" },
    { key: "workaround", label: "Alternativa actual o workaround" },
  ],
  goals: [
    { key: "business_outcome", label: "Resultado comercial u operativo" },
    { key: "user_outcome", label: "Resultado esperado para el usuario" },
    { key: "mvp_objective", label: "Objetivo del MVP" },
    { key: "priorities", label: "Prioridades" },
    { key: "secondary_goals", label: "Objetivos secundarios" },
    { key: "exclusions", label: "Exclusiones explícitas" },
    { key: "time_horizon", label: "Horizonte temporal" },
  ],
  users: [
    { key: "user_types", label: "Tipos de usuario" },
    { key: "responsibilities", label: "Responsabilidades" },
    { key: "user_goals", label: "Objetivos de cada usuario" },
    { key: "usage_context", label: "Contexto de uso" },
    { key: "technical_level", label: "Nivel técnico" },
    { key: "channel_device", label: "Canal o dispositivo" },
    { key: "usage_frequency", label: "Frecuencia de uso" },
    { key: "limitations", label: "Limitaciones relevantes" },
  ],
  roles: [
    { key: "role_catalog", label: "Roles del sistema" },
    { key: "allowed_actions", label: "Acciones permitidas" },
    { key: "prohibited_actions", label: "Acciones prohibidas" },
    { key: "organizational_scope", label: "Alcance organizacional" },
    { key: "separation_of_duties", label: "Separación de responsabilidades" },
    { key: "approvals", label: "Aprobaciones requeridas" },
    { key: "exceptions", label: "Casos excepcionales" },
    { key: "role_administration", label: "Administración de roles" },
    { key: "deactivation_behavior", label: "Comportamiento al desactivar usuarios" },
  ],
  workflow: [
    { key: "trigger", label: "Evento inicial" },
    { key: "initiator", label: "Actor iniciador" },
    { key: "happy_path", label: "Camino exitoso" },
    { key: "states", label: "Estados" },
    { key: "transitions", label: "Transiciones" },
    { key: "stage_ownership", label: "Responsable de cada etapa" },
    { key: "validations", label: "Validaciones" },
    { key: "cancellation", label: "Cancelación" },
    { key: "failure", label: "Errores" },
    { key: "retry", label: "Reintentos" },
    { key: "rollback", label: "Reversión" },
    { key: "terminal_state", label: "Estado final" },
    { key: "exceptions", label: "Casos excepcionales" },
  ],
  domain: [
    { key: "entities", label: "Entidades principales" },
    { key: "entity_purpose", label: "Propósito de cada entidad" },
    { key: "identity", label: "Identidad" },
    { key: "relationships", label: "Relaciones" },
    { key: "business_rules", label: "Reglas de negocio" },
    { key: "invariants", label: "Invariantes" },
    { key: "lifecycle", label: "Ciclo de vida" },
    { key: "initial_state", label: "Estado inicial" },
    { key: "terminal_states", label: "Estados terminales" },
    { key: "domain_events", label: "Eventos de dominio" },
  ],
  data: [
    { key: "core_data", label: "Datos principales" },
    { key: "sources", label: "Fuentes" },
    { key: "ownership", label: "Propiedad" },
    { key: "sensitivity", label: "Sensibilidad" },
    { key: "relationships", label: "Relaciones" },
    { key: "retention", label: "Retención" },
    { key: "deletion", label: "Eliminación" },
    { key: "auditability", label: "Auditoría" },
    { key: "volume", label: "Volumen aproximado" },
    { key: "consistency", label: "Consistencia requerida" },
    { key: "import_export", label: "Importación y exportación" },
    { key: "derived_data", label: "Datos derivados" },
    { key: "regulatory", label: "Requisitos regulatorios" },
  ],
  integrations: [
    { key: "systems", label: "Sistemas o proveedores" },
    { key: "purpose", label: "Propósito" },
    { key: "direction", label: "Dirección del intercambio" },
    { key: "exchanged_data", label: "Datos enviados y recibidos" },
    { key: "authentication", label: "Autenticación" },
    { key: "protocol", label: "Contrato o protocolo" },
    { key: "timeout", label: "Timeout" },
    { key: "retry", label: "Reintentos" },
    { key: "idempotency", label: "Idempotencia" },
    { key: "duplicate_handling", label: "Manejo de duplicados" },
    { key: "reconciliation", label: "Reconciliación" },
    { key: "degradation", label: "Degradación" },
    { key: "outage_behavior", label: "Comportamiento ante indisponibilidad" },
  ],
  security: [
    { key: "authentication", label: "Autenticación" },
    { key: "authorization", label: "Autorización" },
    { key: "tenant_isolation", label: "Aislamiento entre organizaciones" },
    { key: "sensitive_data", label: "Datos sensibles" },
    { key: "secrets", label: "Secretos" },
    { key: "account_recovery", label: "Recuperación de cuenta" },
    { key: "auditability", label: "Auditoría" },
    { key: "privacy", label: "Privacidad" },
    { key: "threats", label: "Amenazas principales" },
    { key: "regulatory", label: "Requisitos regulatorios" },
    { key: "access_revocation", label: "Eliminación de acceso" },
    { key: "sessions", label: "Sesiones" },
    { key: "critical_operations", label: "Operaciones críticas" },
    { key: "admin_controls", label: "Controles administrativos" },
  ],
  operations: [
    { key: "environments", label: "Ambientes" },
    { key: "deployment", label: "Despliegue" },
    { key: "observability", label: "Observabilidad" },
    { key: "logs", label: "Logs" },
    { key: "metrics", label: "Métricas" },
    { key: "alerts", label: "Alertas" },
    { key: "backups", label: "Backups" },
    { key: "restore", label: "Restauración" },
    { key: "disaster_recovery", label: "Recuperación ante desastre" },
    { key: "incidents", label: "Manejo de incidentes" },
    { key: "support", label: "Soporte" },
    { key: "operational_owner", label: "Propietario operacional" },
    { key: "maintenance", label: "Mantenimiento" },
    { key: "external_dependencies", label: "Dependencias externas" },
    { key: "degraded_offline", label: "Modo degradado u offline" },
  ],
  constraints: [
    { key: "time", label: "Tiempo" },
    { key: "budget", label: "Presupuesto" },
    { key: "mandatory_technology", label: "Tecnología obligatoria" },
    { key: "prohibited_technology", label: "Tecnología prohibida" },
    { key: "team", label: "Equipo disponible" },
    { key: "regulatory", label: "Regulaciones" },
    { key: "compatibility", label: "Compatibilidad" },
    { key: "devices", label: "Dispositivos" },
    { key: "data_residency", label: "Residencia de datos" },
    { key: "organizational_dependencies", label: "Dependencias organizacionales" },
    { key: "performance", label: "Rendimiento" },
    { key: "contractual", label: "Restricciones contractuales" },
  ],
  success_metrics: [
    { key: "measurable_outcome", label: "Resultado medible" },
    { key: "metric", label: "Métrica" },
    { key: "baseline", label: "Línea base" },
    { key: "target", label: "Objetivo" },
    { key: "measurement_period", label: "Periodo de medición" },
    { key: "data_source", label: "Fuente del dato" },
    { key: "owner", label: "Responsable" },
    { key: "acceptance_criteria", label: "Criterio de aceptación" },
    { key: "failure_signals", label: "Señales de fracaso" },
  ],
  delivery: [
    { key: "mvp_scope", label: "Alcance del MVP" },
    { key: "out_of_scope", label: "Fuera de alcance" },
    { key: "dependencies", label: "Dependencias" },
    { key: "priority", label: "Prioridad" },
    { key: "implementation_order", label: "Orden de implementación" },
    { key: "vertical_slice", label: "Vertical Slice inicial" },
    { key: "acceptance_criteria", label: "Criterios de aceptación" },
    { key: "test_strategy", label: "Estrategia de pruebas" },
    { key: "timeline", label: "Fecha o restricción temporal" },
    { key: "delivery_risks", label: "Riesgos de entrega" },
    { key: "launch_conditions", label: "Condiciones para lanzamiento" },
  ],
} as const satisfies Record<
  DiscoveryV2CoverageKey,
  readonly DiscoveryV2EvidenceCriterion[]
>;

export const discoveryV2NotApplicableDimensions = [
  "roles",
  "integrations",
] as const satisfies readonly DiscoveryV2CoverageKey[];

export type DiscoveryV2CriterionDisposition = {
  key: string;
  reason: string;
};

export type DiscoveryV2CoverageEvidence = {
  criterionKey: string;
  statement: string;
  sourceMessageIds: string[];
};

export type DiscoveryV2CoverageAssessment = {
  dimension: DiscoveryV2CoverageKey;
  status: DiscoveryV2CoverageStatus;
  satisfiedCriteria: string[];
  missingCriteria: string[];
  notApplicableCriteria: DiscoveryV2CriterionDisposition[];
  evidence: DiscoveryV2CoverageEvidence[];
  rationale: string;
  confidence: number;
};

export type DiscoveryV2ArtifactReadiness = {
  artifact: DiscoveryV2ArtifactType;
  status: DiscoveryV2ArtifactReadinessStatus;
  requiredDimensions: DiscoveryV2CoverageKey[];
  blockers: string[];
};

export type DiscoveryV2Issue = {
  kind: "gap" | "contradiction";
  severity: DiscoveryV2IssueSeverity;
  status:
    | "open"
    | "resolved"
    | "deferred"
    | "accepted_open"
    | "dismissed"
    | "superseded";
  description: string;
  affectedArtifacts: DiscoveryV2ArtifactType[];
};

export const discoveryV2ArtifactRequirements: Record<
  DiscoveryV2ArtifactType,
  readonly DiscoveryV2CoverageKey[]
> = {
  product_spec: [
    "problem",
    "goals",
    "users",
    "workflow",
    "constraints",
    "success_metrics",
  ],
  mvp_scope: [
    "goals",
    "workflow",
    "constraints",
    "success_metrics",
    "delivery",
  ],
  domain_model: ["users", "roles", "workflow", "domain"],
  architecture: [
    "workflow",
    "domain",
    "data",
    "integrations",
    "security",
    "operations",
    "constraints",
    "delivery",
  ],
  data_model: ["domain", "data", "security", "constraints"],
  security: [
    "users",
    "roles",
    "data",
    "integrations",
    "security",
    "operations",
  ],
  backlog: [
    "goals",
    "users",
    "workflow",
    "constraints",
    "success_metrics",
    "delivery",
  ],
  vertical_slice_plan: [
    "workflow",
    "domain",
    "data",
    "integrations",
    "security",
    "delivery",
  ],
};

const uncertaintyMarkers = [
  "quizas",
  "quiza",
  "tal vez",
  "probablemente",
  "posiblemente",
  "puede que",
  "creo que",
  "no estoy seguro",
  "se vera despues",
  "podria",
  "podriamos",
] as const;

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function containsDiscoveryV2Uncertainty(value: string): boolean {
  const normalized = normalizeComparableText(value);
  return uncertaintyMarkers.some((marker) => normalized.includes(marker));
}

export function normalizeDiscoveryV2KnowledgeStatus(input: {
  statement: string;
  requestedStatus: DiscoveryV2KnowledgeValidationStatus;
}): DiscoveryV2KnowledgeValidationStatus {
  if (
    input.requestedStatus === "confirmed" &&
    containsDiscoveryV2Uncertainty(input.statement)
  ) {
    return "proposed";
  }

  return input.requestedStatus;
}

export function getDiscoveryV2CriterionKeys(
  dimension: DiscoveryV2CoverageKey
): string[] {
  return discoveryV2EvidenceCriteria[dimension].map((criterion) => criterion.key);
}

export function validateDiscoveryV2CoverageAssessment(
  assessment: DiscoveryV2CoverageAssessment
): string[] {
  const errors: string[] = [];
  const validCriteria = new Set(getDiscoveryV2CriterionKeys(assessment.dimension));
  const satisfied = new Set(assessment.satisfiedCriteria);
  const missing = new Set(assessment.missingCriteria);
  const notApplicable = new Map(
    assessment.notApplicableCriteria.map((criterion) => [
      criterion.key,
      criterion.reason.trim(),
    ])
  );

  const allReferenced = [
    ...assessment.satisfiedCriteria,
    ...assessment.missingCriteria,
    ...assessment.notApplicableCriteria.map((criterion) => criterion.key),
  ];

  for (const criterion of allReferenced) {
    if (!validCriteria.has(criterion)) {
      errors.push(
        `El criterio ${criterion} no pertenece a ${assessment.dimension}.`
      );
    }
  }

  if (new Set(allReferenced).size !== allReferenced.length) {
    errors.push("Los criterios no pueden aparecer en más de una disposición.");
  }

  for (const criterion of validCriteria) {
    if (
      !satisfied.has(criterion) &&
      !missing.has(criterion) &&
      !notApplicable.has(criterion)
    ) {
      errors.push(`Falta clasificar el criterio ${criterion}.`);
    }
  }

  for (const [criterion, reason] of notApplicable) {
    if (!reason) {
      errors.push(
        `El criterio no aplicable ${criterion} requiere una justificación.`
      );
    }
  }

  const evidenceCriteria = new Set(
    assessment.evidence.map((item) => item.criterionKey)
  );

  for (const criterion of assessment.satisfiedCriteria) {
    if (!evidenceCriteria.has(criterion)) {
      errors.push(
        `El criterio satisfecho ${criterion} requiere evidencia trazable.`
      );
    }
  }

  for (const evidence of assessment.evidence) {
    if (!satisfied.has(evidence.criterionKey)) {
      errors.push(
        `La evidencia de ${evidence.criterionKey} solo puede respaldar un criterio satisfecho.`
      );
    }

    if (evidence.sourceMessageIds.length === 0) {
      errors.push(
        `La evidencia de ${evidence.criterionKey} requiere al menos un sourceMessageId.`
      );
    }
  }

  if (assessment.status === "complete" && missing.size > 0) {
    errors.push(
      "Una dimensión completa no puede conservar criterios faltantes."
    );
  }

  if (
    assessment.status === "missing" &&
    (satisfied.size > 0 || notApplicable.size > 0)
  ) {
    errors.push(
      "Una dimensión faltante no puede contener criterios satisfechos o no aplicables."
    );
  }

  if (
    assessment.status === "partial" &&
    (satisfied.size === 0 || missing.size === 0)
  ) {
    errors.push(
      "Una dimensión parcial requiere criterios satisfechos y criterios faltantes."
    );
  }

  if (assessment.status === "not_applicable") {
    if (
      !discoveryV2NotApplicableDimensions.includes(
        assessment.dimension as (typeof discoveryV2NotApplicableDimensions)[number]
      )
    ) {
      errors.push(
        `La dimensión ${assessment.dimension} no puede marcarse como no aplicable.`
      );
    }

    if (assessment.rationale.trim().length < 20) {
      errors.push(
        "Una dimensión no aplicable requiere una justificación explícita."
      );
    }

    if (
      satisfied.size > 0 ||
      missing.size > 0 ||
      notApplicable.size !== validCriteria.size
    ) {
      errors.push(
        "Una dimensión no aplicable debe justificar todos sus criterios como no aplicables."
      );
    }
  }

  return errors;
}

export function calculateDiscoveryV2ArtifactReadiness(input: {
  coverage: Record<DiscoveryV2CoverageKey, DiscoveryV2CoverageAssessment>;
  issues: DiscoveryV2Issue[];
}): DiscoveryV2ArtifactReadiness[] {
  return discoveryV2ArtifactTypes.map((artifact) => {
    const requiredDimensions = [...discoveryV2ArtifactRequirements[artifact]];
    const openIssues = input.issues.filter(
      (issue) =>
        issue.status === "open" && issue.affectedArtifacts.includes(artifact)
    );
    const missingDimensions = requiredDimensions.filter(
      (dimension) => input.coverage[dimension].status === "missing"
    );
    const partialDimensions = requiredDimensions.filter(
      (dimension) => input.coverage[dimension].status === "partial"
    );
    const criticalIssues = openIssues.filter(
      (issue) => issue.severity === "critical"
    );
    const highIssues = openIssues.filter((issue) => issue.severity === "high");

    const blockers = [
      ...missingDimensions.map(
        (dimension) => `Cobertura faltante: ${dimension}`
      ),
      ...criticalIssues.map((issue) => issue.description),
      ...highIssues.map((issue) => issue.description),
    ];

    let status: DiscoveryV2ArtifactReadinessStatus;

    if (criticalIssues.length > 0 || missingDimensions.length > 0) {
      status = "blocked";
    } else if (partialDimensions.length > 0 || highIssues.length > 0) {
      status = requiredDimensions.every(
        (dimension) => input.coverage[dimension].status !== "missing"
      )
        ? "usable"
        : "insufficient";
    } else {
      status = "ready";
    }

    return {
      artifact,
      status,
      requiredDimensions,
      blockers: [...new Set(blockers)],
    };
  });
}

export type DiscoveryV2CompletionAssessment = {
  eligibleForReview: boolean;
  eligibleForCompletion: boolean;
  eligibleForCompletionWithOpenItems: boolean;
  blockers: string[];
};

export function assessDiscoveryV2Completion(input: {
  coverage: Record<DiscoveryV2CoverageKey, DiscoveryV2CoverageAssessment>;
  artifactReadiness: DiscoveryV2ArtifactReadiness[];
  issues: DiscoveryV2Issue[];
  summaryConfirmed: boolean;
  openItemsAcknowledged: boolean;
  authorizedException: boolean;
}): DiscoveryV2CompletionAssessment {
  const blockers: string[] = [];
  const criticalOpenIssues = input.issues.filter(
    (issue) => issue.status === "open" && issue.severity === "critical"
  );
  const highOpenGaps = input.issues.filter(
    (issue) =>
      issue.kind === "gap" &&
      issue.status === "open" &&
      (issue.severity === "high" || issue.severity === "critical")
  );
  const openContradictions = input.issues.filter(
    (issue) => issue.kind === "contradiction" && issue.status === "open"
  );
  const allAtLeastPartial = discoveryV2CoverageKeys.every((dimension) => {
    const status = input.coverage[dimension].status;
    return status !== "missing";
  });
  const allCompleteOrNotApplicable = discoveryV2CoverageKeys.every(
    (dimension) => {
      const status = input.coverage[dimension].status;
      return status === "complete" || status === "not_applicable";
    }
  );
  const coreComplete = ([
    "problem",
    "goals",
    "users",
    "workflow",
  ] as const).every(
    (dimension) => input.coverage[dimension].status === "complete"
  );
  const usableOrReadyArtifacts = input.artifactReadiness.filter(
    (artifact) => artifact.status === "usable" || artifact.status === "ready"
  ).length;
  const allArtifactsUsableOrReady = input.artifactReadiness.every(
    (artifact) => artifact.status === "usable" || artifact.status === "ready"
  );
  const hasBlockedArtifact = input.artifactReadiness.some(
    (artifact) => artifact.status === "blocked"
  );

  const eligibleForReview =
    criticalOpenIssues.length === 0 &&
    allAtLeastPartial &&
    coreComplete &&
    usableOrReadyArtifacts >= 6;

  const eligibleForCompletion =
    allCompleteOrNotApplicable &&
    openContradictions.length === 0 &&
    highOpenGaps.length === 0 &&
    allArtifactsUsableOrReady &&
    input.summaryConfirmed;

  const eligibleForCompletionWithOpenItems =
    criticalOpenIssues.length === 0 &&
    allAtLeastPartial &&
    !hasBlockedArtifact &&
    usableOrReadyArtifacts >= 6 &&
    input.openItemsAcknowledged &&
    input.authorizedException;

  if (!coreComplete) {
    blockers.push(
      "Problema, objetivos, usuarios y workflow deben estar completos."
    );
  }

  if (!allAtLeastPartial) {
    blockers.push("Existen dimensiones sin cobertura mínima.");
  }

  if (criticalOpenIssues.length > 0) {
    blockers.push("Existen gaps o contradicciones críticas abiertas.");
  }

  if (usableOrReadyArtifacts < 6) {
    blockers.push("Menos de seis documentos tienen evidencia utilizable.");
  }

  if (!input.summaryConfirmed) {
    blockers.push("El resumen final todavía no fue confirmado.");
  }

  return {
    eligibleForReview,
    eligibleForCompletion,
    eligibleForCompletionWithOpenItems,
    blockers: [...new Set(blockers)],
  };
}

export type DiscoveryV2QuestionPriorityFactors = {
  businessImpact: number;
  architectureImpact: number;
  securityImpact: number;
  dependencyImpact: number;
  uncertainty: number;
  documentBlocker: number;
  redundancy: number;
  userFatigue: number;
  contradictionSeverity?: DiscoveryV2IssueSeverity | null;
  gapSeverity?: DiscoveryV2IssueSeverity | null;
};

function boundedFactor(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function severityBonus(
  severity: DiscoveryV2IssueSeverity | null | undefined,
  kind: "contradiction" | "gap"
): number {
  if (!severity) {
    return 0;
  }

  const base = {
    low: 1,
    medium: 3,
    high: 6,
    critical: 10,
  }[severity];

  return kind === "contradiction" ? base + 2 : base;
}

export function calculateDiscoveryV2QuestionPriorityScore(
  factors: DiscoveryV2QuestionPriorityFactors
): number {
  const positive =
    boundedFactor(factors.businessImpact) +
    boundedFactor(factors.architectureImpact) +
    boundedFactor(factors.securityImpact) +
    boundedFactor(factors.dependencyImpact) +
    boundedFactor(factors.uncertainty) +
    boundedFactor(factors.documentBlocker);
  const negative =
    boundedFactor(factors.redundancy) + boundedFactor(factors.userFatigue);

  return (
    positive -
    negative +
    severityBonus(factors.contradictionSeverity, "contradiction") +
    severityBonus(factors.gapSeverity, "gap")
  );
}

export type DiscoveryV2TurnMode =
  | "normal"
  | "blockers_only"
  | "human_review_required";

export function getDiscoveryV2TurnMode(turnCount: number): DiscoveryV2TurnMode {
  if (turnCount >= DISCOVERY_V2_HARD_TURN_LIMIT) {
    return "human_review_required";
  }

  if (turnCount >= DISCOVERY_V2_SOFT_TURN_LIMIT) {
    return "blockers_only";
  }

  return "normal";
}
