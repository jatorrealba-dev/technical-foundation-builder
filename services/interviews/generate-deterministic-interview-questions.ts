import type { ArtifactType } from "@/domain/artifacts/artifact";
import type {
  AdaptiveInterviewQuestion,
  InterviewAnswer,
  InterviewQuestionPriority,
  InterviewStage,
} from "@/domain/interviews/interview";

import {
  createInterviewQuestionFingerprint,
  normalizeInterviewText,
  questionsAreSemanticallyEquivalent,
} from "./interview-fingerprint.ts";

export type ProposedInterviewQuestion = {
  id: string;
  stage: InterviewStage;
  question: string;
  helperText: string;
  reason: string;
  priority: InterviewQuestionPriority;
  affectsArtifacts: ArtifactType[];
  riskArea: string | null;
  required: boolean;
  fingerprint: string;
};

type Rule = Omit<ProposedInterviewQuestion, "fingerprint"> & {
  evidenceQuestionIds: string[];
  triggerTerms: string[];
  minimumAnswerLength?: number;
};

const rules: Rule[] = [
  {
    id: "adaptive-users-permissions",
    stage: "users",
    question:
      "¿Qué puede hacer cada tipo de usuario y qué acciones deben estar restringidas?",
    helperText:
      "Describe roles, permisos, aprobaciones y cualquier separación de responsabilidades.",
    reason:
      "Los actores ya fueron identificados, pero faltan límites de autorización verificables.",
    priority: "high",
    affectsArtifacts: ["product_spec", "security", "architecture"],
    riskArea: "authorization",
    required: true,
    evidenceQuestionIds: ["users-001"],
    triggerTerms: ["admin", "usuario", "operador", "equipo", "cliente"],
  },
  {
    id: "adaptive-workflow-lifecycle",
    stage: "workflow",
    question:
      "¿Cuál es el flujo principal desde que un usuario inicia una operación hasta que se considera completada?",
    helperText:
      "Incluye estados, responsables, excepciones, cancelaciones y puntos de aprobación.",
    reason:
      "El dominio necesita un lifecycle explícito para producir requisitos y criterios de aceptación.",
    priority: "high",
    affectsArtifacts: [
      "product_spec",
      "domain_model",
      "backlog",
      "vertical_slice_plan",
    ],
    riskArea: "workflow",
    required: true,
    evidenceQuestionIds: ["idea-001", "product-001", "domain-001"],
    triggerTerms: [],
    minimumAnswerLength: 40,
  },
  {
    id: "adaptive-data-retention",
    stage: "data",
    question:
      "¿Qué datos deben conservarse, durante cuánto tiempo y quién puede eliminarlos o exportarlos?",
    helperText:
      "Incluye información histórica, respaldos, archivos, auditoría y requisitos de borrado.",
    reason:
      "La clasificación de datos no define todavía retención, propiedad ni lifecycle de información.",
    priority: "high",
    affectsArtifacts: ["data_model", "security", "architecture"],
    riskArea: "data_lifecycle",
    required: true,
    evidenceQuestionIds: ["security-001", "domain-001"],
    triggerTerms: ["dato", "documento", "pago", "personal", "privado"],
  },
  {
    id: "adaptive-security-authentication",
    stage: "security",
    question:
      "¿Cómo deben autenticarse los usuarios y qué acciones requieren verificación adicional?",
    helperText:
      "Aclara inicio de sesión, recuperación, MFA, sesiones, dispositivos y operaciones sensibles.",
    reason:
      "Se identificaron datos o roles, pero no el mecanismo de identidad y control de acceso.",
    priority: "high",
    affectsArtifacts: ["security", "architecture", "product_spec"],
    riskArea: "authentication",
    required: true,
    evidenceQuestionIds: ["users-001", "security-001"],
    triggerTerms: ["usuario", "admin", "privado", "pago", "credencial"],
  },
  {
    id: "adaptive-architecture-integrations",
    stage: "architecture",
    question:
      "¿Con qué sistemas externos debe integrarse y qué debe ocurrir cuando una integración falla?",
    helperText:
      "Enumera proveedores, APIs, pagos, correo, almacenamiento, sistemas internos y estrategias de reintento.",
    reason:
      "Las integraciones y sus modos de fallo cambian límites, seguridad y operación.",
    priority: "medium",
    affectsArtifacts: ["architecture", "security", "data_model"],
    riskArea: "integrations",
    required: false,
    evidenceQuestionIds: ["architecture-001", "idea-001"],
    triggerTerms: ["saas", "web", "movil", "api", "pago", "correo", "firebase", "supabase"],
  },
  {
    id: "adaptive-operations-observability",
    stage: "operations",
    question:
      "¿Cómo sabrá el equipo que el sistema funciona correctamente y cómo responderá ante fallos?",
    helperText:
      "Define métricas, logs, alertas, soporte, respaldos, recuperación e incidentes.",
    reason:
      "La solución necesita criterios operativos para poder desplegarse y mantenerse de forma responsable.",
    priority: "medium",
    affectsArtifacts: ["architecture", "security", "vertical_slice_plan"],
    riskArea: "operations",
    required: false,
    evidenceQuestionIds: ["architecture-001", "delivery-001"],
    triggerTerms: [],
    minimumAnswerLength: 25,
  },
  {
    id: "adaptive-delivery-success",
    stage: "delivery",
    question:
      "¿Cómo se medirá que el MVP fue exitoso y qué condición permitiría considerarlo listo para uso real?",
    helperText:
      "Incluye métricas, criterios de aceptación, volumen esperado, usuarios piloto y límites de calidad.",
    reason:
      "El alcance inicial necesita una definición de éxito verificable y no solo una lista de funcionalidades.",
    priority: "high",
    affectsArtifacts: ["mvp_scope", "backlog", "vertical_slice_plan"],
    riskArea: "acceptance",
    required: true,
    evidenceQuestionIds: ["delivery-001", "product-001"],
    triggerTerms: [],
    minimumAnswerLength: 20,
  },
];

function answerFor(
  answers: InterviewAnswer[],
  questionId: string
): string {
  return (
    answers.find((answer) => answer.questionId === questionId)?.answer ?? ""
  );
}

function ruleHasEvidence(rule: Rule, answers: InterviewAnswer[]): boolean {
  const combined = rule.evidenceQuestionIds
    .map((questionId) => answerFor(answers, questionId))
    .filter(Boolean)
    .join(" ");

  if (!combined) {
    return false;
  }

  if (
    rule.minimumAnswerLength &&
    combined.trim().length < rule.minimumAnswerLength
  ) {
    return false;
  }

  if (rule.triggerTerms.length === 0) {
    return true;
  }

  const normalized = normalizeInterviewText(combined);
  return rule.triggerTerms.some((term) =>
    normalized.includes(normalizeInterviewText(term))
  );
}

export function generateDeterministicInterviewQuestions(input: {
  answers: InterviewAnswer[];
  existingQuestions: Array<
    Pick<AdaptiveInterviewQuestion, "question" | "fingerprint" | "status">
  >;
  limit?: number;
}): ProposedInterviewQuestion[] {
  const limit = Math.max(1, Math.min(input.limit ?? 6, 8));

  return rules
    .filter((rule) => ruleHasEvidence(rule, input.answers))
    .filter((rule) => {
      const fingerprint = createInterviewQuestionFingerprint(rule);
      return !input.existingQuestions.some(
        (question) =>
          question.fingerprint === fingerprint ||
          questionsAreSemanticallyEquivalent(
            question.question,
            rule.question
          )
      );
    })
    .slice(0, limit)
    .map((rule) => ({
      id: rule.id,
      stage: rule.stage,
      question: rule.question,
      helperText: rule.helperText,
      reason: rule.reason,
      priority: rule.priority,
      affectsArtifacts: rule.affectsArtifacts,
      riskArea: rule.riskArea,
      required: rule.required,
      fingerprint: createInterviewQuestionFingerprint(rule),
    }));
}
