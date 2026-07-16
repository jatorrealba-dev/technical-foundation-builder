import assert from "node:assert/strict";
import test from "node:test";

import {
  getReadinessLevel,
  readinessDimensions,
} from "../domain/readiness/readiness.ts";
import { generateDeterministicReadinessAssessment } from "../services/readiness/generate-deterministic-readiness.ts";
import { normalizeAgentReadinessOutput } from "../services/readiness/normalize-agent-readiness-output.ts";
import { createReadinessFingerprint } from "../services/readiness/readiness-fingerprint.ts";

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

test("readiness fingerprints are stable across accents and order", () => {
  const left = createReadinessFingerprint(
    "Preparación crítica",
    ["Security", "Architecture"]
  );
  const right = createReadinessFingerprint(
    "preparacion critica",
    ["architecture", "security"]
  );

  assert.equal(left, right);
});

test("readiness levels use conservative score thresholds", () => {
  assert.equal(getReadinessLevel(20), "not_ready");
  assert.equal(getReadinessLevel(50), "at_risk");
  assert.equal(getReadinessLevel(70), "progressing");
  assert.equal(getReadinessLevel(80), "ready_for_review");
  assert.equal(getReadinessLevel(95), "ready");
});

test("deterministic readiness returns all eight dimensions and caps critical projects", () => {
  const assessment = generateDeterministicReadinessAssessment({
    projectModel: createModel({
      requirements: [],
      risks: [
        {
          id: "risk-1",
          title: "Tenant data exposure",
          description: "Cross-tenant reads could expose customer data.",
          probability: "high",
          impact: "high",
          mitigation: "",
        },
      ],
    }),
    modelVersionNumber: 1,
    artifacts: [],
    artifactStates: [],
    consistencyFindings: [
      {
        severity: "critical",
        category: "security_gap",
        status: "open",
        title: "Tenant isolation is not verified",
      },
    ],
    interview: {
      status: "in_progress",
      answeredCount: 1,
      totalQuestions: 7,
    },
  });

  assert.deepEqual(
    assessment.dimensions.map((dimension) => dimension.key).sort(),
    [...readinessDimensions].sort()
  );
  assert.equal(assessment.dimensions.length, 8);
  assert.ok(assessment.overallScore <= 49);
  assert.equal(assessment.level, getReadinessLevel(assessment.overallScore));
  assert.ok(
    assessment.blockers.some(
      (blocker) => blocker.priority === "critical"
    )
  );
});

test("deterministic readiness rewards coherent current artifacts", () => {
  const artifacts = [
    { type: "product_spec", content: "REQ-1 confirmed" },
    { type: "mvp_scope", content: "Acceptance criteria and tests" },
    { type: "domain_model", content: "Entity Customer" },
    { type: "architecture", content: "Deployment monitoring rollback" },
    { type: "data_model", content: "Entity Customer table" },
    { type: "security", content: "Security controls logging incident response" },
    { type: "backlog", content: "REQ-1 acceptance test" },
    { type: "vertical_slice_plan", content: "Testing deployment monitoring" },
  ];

  const assessment = generateDeterministicReadinessAssessment({
    projectModel: createModel({
      status: "approved",
      requirements: [
        {
          id: "REQ-1",
          title: "Create customer",
          description: "Create customer records.",
          type: "functional",
          priority: "must",
          status: "confirmed",
        },
        {
          id: "REQ-OPS",
          title: "Operate service",
          description: "Monitor service health.",
          type: "operational",
          priority: "should",
          status: "confirmed",
        },
      ],
      domainEntities: [
        {
          id: "entity-customer",
          name: "Customer",
          description: "Customer account.",
          status: "confirmed",
        },
      ],
    }),
    modelVersionNumber: 2,
    artifacts,
    artifactStates: artifacts.map((artifact) => ({
      artifactType: artifact.type,
      status: "current",
      basedOnModelVersion: 2,
      reason: null,
    })),
    consistencyFindings: [],
    interview: {
      status: "completed",
      answeredCount: 7,
      totalQuestions: 7,
    },
  });

  assert.ok(assessment.overallScore >= 75);
  assert.ok(
    assessment.dimensions.find(
      (dimension) => dimension.key === "testing"
    ).score >= 75
  );
  assert.ok(
    assessment.dimensions.find(
      (dimension) => dimension.key === "operations"
    ).score >= 75
  );
});

test("agent readiness normalization fills a missing operations dimension conservatively", () => {
  const output = {
    summary: "Project assessment",
    overallScore: 90,
    dimensions: [
      "product",
      "domain",
      "architecture",
      "data",
      "security",
      "testing",
      "delivery",
    ].map((key) => ({
      key,
      score: 80,
      rationale: `${key} rationale`,
      evidence: [],
      gaps: [],
    })),
    blockers: [],
    nextActions: [],
    confidence: 0.8,
  };

  const assessment = normalizeAgentReadinessOutput(output, "run-1");
  const operations = assessment.dimensions.find(
    (dimension) => dimension.key === "operations"
  );

  assert.equal(operations.score, 0);
  assert.ok(operations.gaps.length > 0);
  assert.ok(assessment.overallScore < output.overallScore);
});
