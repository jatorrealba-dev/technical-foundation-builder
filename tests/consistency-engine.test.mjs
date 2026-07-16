import assert from "node:assert/strict";
import test from "node:test";

import {
  createConsistencyFingerprint,
  contentIncludesReference,
} from "../services/consistency/consistency-fingerprint.ts";
import { generateDeterministicConsistencyFindings } from "../services/consistency/generate-deterministic-findings.ts";
import { normalizeAgentConsistencyOutput } from "../services/consistency/normalize-agent-consistency-output.ts";

function createModel(overrides = {}) {
  return {
    projectId: "project-1",
    status: "generated",
    requirements: [],
    assumptions: [],
    domainEntities: [],
    risks: [],
    openQuestions: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("fingerprints are stable across artifact ordering and accents", () => {
  const left = createConsistencyFingerprint(
    "Regla crítica",
    ["security", "architecture"]
  );
  const right = createConsistencyFingerprint(
    "regla critica",
    ["architecture", "security"]
  );

  assert.equal(left, right);
});

test("traceability matching accepts identifiers or normalized labels", () => {
  assert.equal(
    contentIncludesReference({
      content: "## REQ-01\nRegistro de usuarios",
      id: "req-01",
      label: "Otro texto",
    }),
    true
  );

  assert.equal(
    contentIncludesReference({
      content: "El sistema incluye gestión de información técnica.",
      label: "Gestión de información técnica",
    }),
    true
  );
});

test("deterministic engine detects missing artifacts and high-priority governance gaps", () => {
  const findings = generateDeterministicConsistencyFindings({
    projectModel: createModel({
      requirements: [
        {
          id: "req-auth",
          title: "Autenticación segura",
          description: "Los usuarios deben autenticarse.",
          type: "security",
          priority: "must",
          status: "proposed",
        },
      ],
      assumptions: [
        {
          id: "asm-scale",
          statement: "La carga inicial será pequeña.",
          impact: "high",
          status: "assumed",
        },
      ],
      openQuestions: [
        {
          id: "q-deploy",
          question: "¿Dónde se desplegará?",
          reason: "Afecta seguridad y operación.",
          priority: "high",
        },
      ],
    }),
    artifacts: [],
    artifactStates: [],
  });

  assert.ok(
    findings.some((finding) =>
      finding.ruleKey.startsWith("artifact_missing:")
    )
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.ruleKey === "must_requirement_unconfirmed:req-auth"
    )
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.ruleKey === "high_impact_assumption:asm-scale"
    )
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.ruleKey === "high_priority_open_question:q-deploy"
    )
  );
});

test("deterministic engine reports missing requirement and entity traceability", () => {
  const findings = generateDeterministicConsistencyFindings({
    projectModel: createModel({
      requirements: [
        {
          id: "req-payment",
          title: "Procesar pagos",
          description: "Procesa pagos del cliente.",
          type: "functional",
          priority: "must",
          status: "confirmed",
        },
      ],
      domainEntities: [
        {
          id: "entity-payment",
          name: "Pago",
          description: "Transacción monetaria.",
          status: "confirmed",
        },
      ],
    }),
    artifacts: [
      { type: "product_spec", content: "Procesar pagos" },
      { type: "mvp_scope", content: "Procesar pagos" },
      { type: "backlog", content: "Sin referencia" },
      { type: "vertical_slice_plan", content: "Sin referencia" },
      { type: "domain_model", content: "Entidad Pago" },
      { type: "data_model", content: "Sin entidad" },
      { type: "architecture", content: "Arquitectura" },
      { type: "security", content: "Seguridad" },
    ],
    artifactStates: [],
  });

  assert.ok(
    findings.some(
      (finding) =>
        finding.ruleKey ===
        "must_requirement_missing:req-payment:backlog"
    )
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.ruleKey ===
        "entity_missing:entity-payment:data_model"
    )
  );
  assert.ok(
    !findings.some(
      (finding) =>
        finding.ruleKey ===
        "entity_missing:entity-payment:domain_model"
    )
  );
});

test("agent consistency output maps known artifact names and preserves evidence", () => {
  const findings = normalizeAgentConsistencyOutput({
    summary: "Summary",
    issues: [
      {
        id: "issue-1",
        severity: "high",
        category: "security_gap",
        description: "Security document omits tenant isolation.",
        evidence: ["Project Model requires multi-tenancy."],
        affectedArtifacts: ["SECURITY.md", "Software Architecture"],
        recommendation: "Add explicit tenant isolation controls.",
      },
    ],
    passedChecks: [],
    requiresHumanReview: true,
    confidence: 0.9,
  });

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].affectedArtifactTypes, [
    "security",
    "architecture",
  ]);
  assert.deepEqual(findings[0].evidence, [
    "Project Model requires multi-tenancy.",
  ]);
  assert.equal(findings[0].source, "agent");
});
