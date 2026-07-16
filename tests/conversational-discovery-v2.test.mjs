import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_V2_HARD_TURN_LIMIT,
  DISCOVERY_V2_SOFT_TURN_LIMIT,
  assessDiscoveryV2Completion,
  calculateDiscoveryV2ArtifactReadiness,
  calculateDiscoveryV2QuestionPriorityScore,
  discoveryV2ArtifactTypes,
  discoveryV2CoverageKeys,
  discoveryV2EvidenceCriteria,
  getDiscoveryV2TurnMode,
  normalizeDiscoveryV2KnowledgeStatus,
  validateDiscoveryV2CoverageAssessment,
} from "../domain/discovery/discovery-v2.ts";
import { discoveryAgentOutputV2Schema } from "../schemas/discovery/discovery-agent-output-v2.ts";

function buildCoverageAssessment(dimension, status = "complete") {
  const criteria = discoveryV2EvidenceCriteria[dimension].map(
    (criterion) => criterion.key
  );

  if (status === "not_applicable") {
    return {
      dimension,
      status,
      satisfiedCriteria: [],
      missingCriteria: [],
      notApplicableCriteria: criteria.map((key) => ({
        key,
        reason: "Confirmed explicitly as outside the product context.",
      })),
      evidence: [],
      rationale: "The user explicitly confirmed this dimension does not apply.",
      confidence: 0.95,
    };
  }

  if (status === "missing") {
    return {
      dimension,
      status,
      satisfiedCriteria: [],
      missingCriteria: criteria,
      notApplicableCriteria: [],
      evidence: [],
      rationale: "No evidence is available.",
      confidence: 0.9,
    };
  }

  const satisfiedCriteria =
    status === "partial" ? criteria.slice(0, 1) : criteria;
  const missingCriteria = status === "partial" ? criteria.slice(1) : [];

  return {
    dimension,
    status,
    satisfiedCriteria,
    missingCriteria,
    notApplicableCriteria: [],
    evidence: satisfiedCriteria.map((criterionKey) => ({
      criterionKey,
      statement: `Evidence for ${dimension}.${criterionKey}`,
      sourceMessageIds: [`message-${dimension}-${criterionKey}`],
    })),
    rationale: `Coverage assessment for ${dimension}.`,
    confidence: 0.9,
  };
}

function buildCoverage(overrides = {}) {
  return Object.fromEntries(
    discoveryV2CoverageKeys.map((dimension) => [
      dimension,
      overrides[dimension] ?? buildCoverageAssessment(dimension),
    ])
  );
}

function buildArtifactReadiness(status = "ready") {
  return discoveryV2ArtifactTypes.map((artifact) => ({
    artifact,
    status,
    requiredDimensions: [],
    blockers: [],
  }));
}

function buildValidAgentOutput() {
  return {
    promptVersion: "discovery.v2",
    assistantMessage:
      "Entiendo el flujo principal. ¿Qué debe ocurrir si el proveedor no responde?",
    understandingSummary: "El producto y el flujo principal están definidos.",
    extractedKnowledge: [
      {
        id: "knowledge-1",
        type: "requirement",
        dimension: "workflow",
        statement: "El operador registra el ticket.",
        confidence: 0.95,
        validationStatus: "confirmed",
        sourceMessageIds: ["message-1"],
      },
    ],
    gaps: [],
    contradictions: [],
    coverage: discoveryV2CoverageKeys.map((dimension) =>
      buildCoverageAssessment(dimension)
    ),
    artifactReadiness: discoveryV2ArtifactTypes.map((artifact) => ({
      artifact,
      status: "ready",
      blockers: [],
      rationale: "All required dimensions are complete.",
    })),
    nextQuestion: {
      text: "¿Qué debe ocurrir si el proveedor no responde?",
      reason: "Define la estrategia de fallo de la integración.",
      dimension: "integrations",
      priority: "high",
      affectedArtifacts: ["architecture", "security"],
      priorityFactors: {
        businessImpact: 4,
        architectureImpact: 5,
        securityImpact: 3,
        dependencyImpact: 5,
        uncertainty: 4,
        documentBlocker: 5,
        redundancy: 0,
        userFatigue: 1,
      },
    },
    completionAssessment: {
      recommendation: "continue",
      reason: "The integration failure strategy remains open.",
      eligibleForReview: false,
      eligibleForCompletion: false,
      eligibleForCompletionWithOpenItems: false,
    },
    confidence: 0.9,
  };
}

test("complete coverage requires every criterion and traceable evidence", () => {
  const assessment = buildCoverageAssessment("problem");
  assessment.evidence = assessment.evidence.slice(1);

  const errors = validateDiscoveryV2CoverageAssessment(assessment);

  assert.ok(errors.some((error) => error.includes("requiere evidencia")));
});

test("partial coverage requires satisfied and missing criteria", () => {
  const assessment = buildCoverageAssessment("goals", "partial");
  assert.deepEqual(validateDiscoveryV2CoverageAssessment(assessment), []);

  assessment.missingCriteria = [];
  assert.ok(
    validateDiscoveryV2CoverageAssessment(assessment).some((error) =>
      error.includes("dimensión parcial")
    )
  );
});

test("not applicable requires an allowed dimension and explicit justification", () => {
  const integrations = buildCoverageAssessment(
    "integrations",
    "not_applicable"
  );
  assert.deepEqual(validateDiscoveryV2CoverageAssessment(integrations), []);

  const security = buildCoverageAssessment("security", "not_applicable");
  assert.ok(
    validateDiscoveryV2CoverageAssessment(security).some((error) =>
      error.includes("no puede marcarse como no aplicable")
    )
  );
});

test("uncertain language cannot remain confirmed", () => {
  assert.equal(
    normalizeDiscoveryV2KnowledgeStatus({
      statement: "Quizás necesitemos modo offline.",
      requestedStatus: "confirmed",
    }),
    "proposed"
  );

  assert.equal(
    normalizeDiscoveryV2KnowledgeStatus({
      statement: "El modo offline forma parte del MVP confirmado.",
      requestedStatus: "confirmed",
    }),
    "confirmed"
  );
});

test("artifact readiness is recalculated from coverage and blockers", () => {
  const coverage = buildCoverage({
    integrations: buildCoverageAssessment("integrations", "partial"),
  });
  const readiness = calculateDiscoveryV2ArtifactReadiness({
    coverage,
    issues: [
      {
        kind: "gap",
        severity: "critical",
        status: "open",
        description: "No existe estrategia de fallo del proveedor.",
        affectedArtifacts: ["architecture", "security"],
      },
    ],
  });

  assert.equal(
    readiness.find((item) => item.artifact === "architecture")?.status,
    "blocked"
  );
  assert.equal(
    readiness.find((item) => item.artifact === "product_spec")?.status,
    "ready"
  );
});

test("completion is blocked by critical open issues", () => {
  const assessment = assessDiscoveryV2Completion({
    coverage: buildCoverage(),
    artifactReadiness: buildArtifactReadiness(),
    issues: [
      {
        kind: "contradiction",
        severity: "critical",
        status: "open",
        description: "MVP scope conflicts with a confirmed requirement.",
        affectedArtifacts: ["mvp_scope"],
      },
    ],
    summaryConfirmed: true,
    openItemsAcknowledged: false,
    authorizedException: false,
  });

  assert.equal(assessment.eligibleForReview, false);
  assert.equal(assessment.eligibleForCompletion, false);
});

test("completed with open items requires acknowledgement and authorization", () => {
  const coverage = buildCoverage({
    operations: buildCoverageAssessment("operations", "partial"),
  });
  const readiness = calculateDiscoveryV2ArtifactReadiness({
    coverage,
    issues: [],
  });

  const denied = assessDiscoveryV2Completion({
    coverage,
    artifactReadiness: readiness,
    issues: [],
    summaryConfirmed: false,
    openItemsAcknowledged: true,
    authorizedException: false,
  });
  const allowed = assessDiscoveryV2Completion({
    coverage,
    artifactReadiness: readiness,
    issues: [],
    summaryConfirmed: false,
    openItemsAcknowledged: true,
    authorizedException: true,
  });

  assert.equal(denied.eligibleForCompletionWithOpenItems, false);
  assert.equal(allowed.eligibleForCompletionWithOpenItems, true);
});

test("critical contradictions outrank ordinary detail questions", () => {
  const ordinary = calculateDiscoveryV2QuestionPriorityScore({
    businessImpact: 3,
    architectureImpact: 2,
    securityImpact: 1,
    dependencyImpact: 2,
    uncertainty: 2,
    documentBlocker: 1,
    redundancy: 0,
    userFatigue: 0,
  });
  const contradiction = calculateDiscoveryV2QuestionPriorityScore({
    businessImpact: 2,
    architectureImpact: 2,
    securityImpact: 2,
    dependencyImpact: 2,
    uncertainty: 2,
    documentBlocker: 2,
    redundancy: 0,
    userFatigue: 1,
    contradictionSeverity: "critical",
  });

  assert.ok(contradiction > ordinary);
});

test("turn limits switch to blocker-only and then human review", () => {
  assert.equal(getDiscoveryV2TurnMode(0), "normal");
  assert.equal(
    getDiscoveryV2TurnMode(DISCOVERY_V2_SOFT_TURN_LIMIT),
    "blockers_only"
  );
  assert.equal(
    getDiscoveryV2TurnMode(DISCOVERY_V2_HARD_TURN_LIMIT),
    "human_review_required"
  );
});

test("agent output requires unique coverage and artifact assessments", () => {
  const output = buildValidAgentOutput();
  output.coverage[12] = {
    ...output.coverage[12],
    dimension: "problem",
  };

  assert.equal(discoveryAgentOutputV2Schema.safeParse(output).success, false);
});

test("agent output requires source message traceability", () => {
  const output = buildValidAgentOutput();
  output.extractedKnowledge[0].sourceMessageIds = [];

  assert.equal(discoveryAgentOutputV2Schema.safeParse(output).success, false);
});

test("continue recommendation requires one next question", () => {
  const output = buildValidAgentOutput();
  output.nextQuestion = null;

  assert.equal(discoveryAgentOutputV2Schema.safeParse(output).success, false);
});
