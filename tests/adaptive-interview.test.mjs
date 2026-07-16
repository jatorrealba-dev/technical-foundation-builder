import assert from "node:assert/strict";
import test from "node:test";

import { generateDeterministicInterviewQuestions } from "../services/interviews/generate-deterministic-interview-questions.ts";
import {
  createInterviewQuestionFingerprint,
  questionsAreSemanticallyEquivalent,
} from "../services/interviews/interview-fingerprint.ts";
import { normalizeAgentInterviewQuestions } from "../services/interviews/normalize-agent-interview-output.ts";

function answer(questionId, answer) {
  return {
    questionId,
    answer,
    answeredAt: "2026-07-15T00:00:00.000Z",
  };
}

test("adaptive interview fingerprints are stable across accents and punctuation", () => {
  const left = createInterviewQuestionFingerprint({
    stage: "security",
    question: "¿Cómo se autenticarán los usuarios?",
  });
  const right = createInterviewQuestionFingerprint({
    stage: "security",
    question: "como se autenticaran los usuarios",
  });

  assert.equal(left, right);
});

test("semantic duplicate detection accepts equivalent token sets", () => {
  assert.equal(
    questionsAreSemanticallyEquivalent(
      "¿Qué permisos tienen los administradores y usuarios?",
      "Que permisos tienen usuarios y administradores"
    ),
    true
  );
});

test("deterministic interview proposes high-impact follow-ups from existing evidence", () => {
  const questions = generateDeterministicInterviewQuestions({
    answers: [
      answer(
        "idea-001",
        "Un SaaS web para equipos internos que registra operaciones y documentos."
      ),
      answer(
        "product-001",
        "Reduce errores manuales y permite controlar cada operación."
      ),
      answer(
        "users-001",
        "Administradores, operadores y clientes finales."
      ),
      answer(
        "domain-001",
        "Usuarios, organizaciones, operaciones, documentos y pagos."
      ),
      answer(
        "security-001",
        "Datos privados, credenciales y pagos deben protegerse."
      ),
      answer(
        "architecture-001",
        "Aplicación SaaS web con API y Supabase."
      ),
      answer(
        "delivery-001",
        "MVP con registro, consulta y cierre de operaciones."
      ),
    ],
    existingQuestions: [],
  });

  assert.ok(
    questions.some((question) => question.riskArea === "authorization")
  );
  assert.ok(
    questions.some((question) => question.stage === "workflow")
  );
  assert.ok(
    questions.some((question) => question.riskArea === "data_lifecycle")
  );
  assert.ok(questions.length <= 8);
});

test("deterministic interview removes existing equivalent questions", () => {
  const existingQuestion = {
    question:
      "¿Qué puede hacer cada tipo de usuario y qué acciones deben estar restringidas?",
    fingerprint: createInterviewQuestionFingerprint({
      stage: "users",
      question:
        "¿Qué puede hacer cada tipo de usuario y qué acciones deben estar restringidas?",
    }),
    status: "pending",
  };

  const questions = generateDeterministicInterviewQuestions({
    answers: [
      answer("users-001", "Administradores, operadores y usuarios."),
    ],
    existingQuestions: [existingQuestion],
  });

  assert.equal(
    questions.some((question) => question.riskArea === "authorization"),
    false
  );
});

test("agent interview normalization preserves governance metadata", () => {
  const normalized = normalizeAgentInterviewQuestions({
    summary: "Falta definir recuperación y operación.",
    nextQuestions: [
      {
        id: "q-ops",
        stage: "operations",
        question: "¿Cómo se recuperará el servicio ante una falla?",
        helperText: "Incluye RTO, RPO, respaldos y responsables.",
        reason: "No existe una estrategia de recuperación.",
        priority: "high",
        affectsArtifacts: ["architecture", "security"],
        riskArea: "disaster_recovery",
        required: true,
      },
    ],
    missingInformation: ["Recuperación"],
    contradictions: [],
    recommendation: "continue_interview",
    confidence: 0.9,
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].stage, "operations");
  assert.equal(normalized[0].required, true);
  assert.deepEqual(normalized[0].affectsArtifacts, [
    "architecture",
    "security",
  ]);
  assert.match(normalized[0].fingerprint, /^operations:/);
});
