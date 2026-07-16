import type { ArtifactType } from "@/domain/artifacts/artifact";

export const interviewStages = [
  "idea",
  "product",
  "users",
  "domain",
  "workflow",
  "data",
  "security",
  "architecture",
  "operations",
  "delivery",
] as const;

export type InterviewStage = (typeof interviewStages)[number];

export const interviewQuestionPriorities = [
  "low",
  "medium",
  "high",
] as const;

export type InterviewQuestionPriority =
  (typeof interviewQuestionPriorities)[number];

export const interviewQuestionStatuses = [
  "pending",
  "answered",
  "skipped",
  "deferred",
  "obsolete",
] as const;

export type InterviewQuestionStatus =
  (typeof interviewQuestionStatuses)[number];

export const interviewQuestionSources = [
  "base",
  "deterministic",
  "agent",
  "manual",
] as const;

export type InterviewQuestionSource =
  (typeof interviewQuestionSources)[number];

export type InterviewQuestion = {
  id: string;
  stage: InterviewStage;
  question: string;
  helperText: string;
  reason: string;
  priority: InterviewQuestionPriority;
  sortOrder: number;
  affectsArtifacts: ArtifactType[];
  riskArea: string | null;
  required: boolean;
};

export type AdaptiveInterviewQuestion = InterviewQuestion & {
  databaseId: string | null;
  source: InterviewQuestionSource;
  sourceRunId: string | null;
  status: InterviewQuestionStatus;
  fingerprint: string;
  reviewerComment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type InterviewAnswer = {
  questionId: string;
  answer: string;
  answeredAt: string;
};

export type InterviewBatch = {
  id: string;
  source: "deterministic" | "agent";
  sourceRunId: string | null;
  summary: string;
  recommendation:
    | "continue_interview"
    | "ready_for_model"
    | "requires_human_review";
  confidence: number | null;
  missingInformation: string[];
  contradictions: string[];
  questionCount: number;
  createdAt: string;
};

export type ProjectInterview = {
  projectId: string;
  status: "not_started" | "in_progress" | "completed";
  currentStage: InterviewStage;
  answers: InterviewAnswer[];
  questions: AdaptiveInterviewQuestion[];
  latestBatch: InterviewBatch | null;
  createdAt: string;
  updatedAt: string;
};

export const initialInterviewQuestions: InterviewQuestion[] = [
  {
    id: "idea-001",
    stage: "idea",
    question: "¿Qué quieres construir exactamente?",
    helperText:
      "Descríbelo como si se lo explicaras a un desarrollador que no conoce tu idea.",
    reason:
      "Define la intención del producto y reduce ambigüedad antes de modelar requisitos.",
    priority: "high",
    sortOrder: 10,
    affectsArtifacts: ["product_spec", "mvp_scope"],
    riskArea: "product_definition",
    required: true,
  },
  {
    id: "product-001",
    stage: "product",
    question: "¿Qué problema principal resuelve este producto?",
    helperText:
      "Evita describir solo funcionalidades. Explica el dolor o necesidad real.",
    reason:
      "Permite diferenciar capacidades deseadas de valor real para el usuario.",
    priority: "high",
    sortOrder: 20,
    affectsArtifacts: ["product_spec", "mvp_scope", "backlog"],
    riskArea: "product_value",
    required: true,
  },
  {
    id: "users-001",
    stage: "users",
    question: "¿Quiénes serán los usuarios principales?",
    helperText:
      "Incluye usuarios finales, administradores, operadores, clientes o equipos internos.",
    reason:
      "Los actores y sus responsabilidades determinan permisos, workflows y criterios de aceptación.",
    priority: "high",
    sortOrder: 30,
    affectsArtifacts: ["product_spec", "domain_model", "security"],
    riskArea: "identity_and_access",
    required: true,
  },
  {
    id: "domain-001",
    stage: "domain",
    question: "¿Cuáles son las entidades principales del negocio?",
    helperText:
      "Ejemplo: usuario, proyecto, ticket, empleado, pago, locación, documento, etc.",
    reason:
      "Establece el vocabulario inicial y los límites del dominio.",
    priority: "high",
    sortOrder: 40,
    affectsArtifacts: ["domain_model", "data_model", "architecture"],
    riskArea: "domain_modeling",
    required: true,
  },
  {
    id: "security-001",
    stage: "security",
    question: "¿Qué información debe protegerse especialmente?",
    helperText:
      "Piensa en datos privados, información financiera, documentos sensibles, credenciales o permisos.",
    reason:
      "La clasificación temprana de datos evita decisiones inseguras de arquitectura y acceso.",
    priority: "high",
    sortOrder: 50,
    affectsArtifacts: ["security", "data_model", "architecture"],
    riskArea: "data_protection",
    required: true,
  },
  {
    id: "architecture-001",
    stage: "architecture",
    question: "¿El sistema debe ser web, móvil, interno, SaaS o una combinación?",
    helperText:
      "También indica si debe funcionar para varias empresas, equipos o clientes.",
    reason:
      "Aclara canales, tenancy, distribución y restricciones de plataforma.",
    priority: "medium",
    sortOrder: 60,
    affectsArtifacts: ["architecture", "security", "data_model"],
    riskArea: "solution_shape",
    required: true,
  },
  {
    id: "delivery-001",
    stage: "delivery",
    question: "¿Cuál sería la primera versión útil del producto?",
    helperText:
      "Describe el MVP: lo mínimo que debe existir para que el producto ya entregue valor.",
    reason:
      "Define un corte de entrega verificable y reduce el riesgo de alcance abierto.",
    priority: "high",
    sortOrder: 70,
    affectsArtifacts: ["mvp_scope", "backlog", "vertical_slice_plan"],
    riskArea: "delivery_scope",
    required: true,
  },
];
