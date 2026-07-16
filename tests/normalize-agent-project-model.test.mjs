import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAgentProjectModel } from "../services/project-model/normalize-agent-project-model.ts";

const output = {
  summary: "Structured model",
  requirements: [
    {
      id: "req-1",
      title: "Requirement",
      description: "Description",
      type: "functional",
      priority: "must",
      status: "proposed",
      evidence: ["Interview answer"],
    },
  ],
  assumptions: [
    {
      id: "assumption-1",
      statement: "Assumption",
      impact: "medium",
      status: "assumed",
      evidence: ["Incomplete context"],
    },
  ],
  domainEntities: [
    {
      id: "entity-1",
      name: "Project",
      description: "Project entity",
      status: "confirmed",
      evidence: ["Project scope"],
    },
  ],
  risks: [
    {
      id: "risk-1",
      title: "Risk",
      description: "Risk description",
      probability: "low",
      impact: "high",
      mitigation: "Mitigate",
    },
  ],
  openQuestions: [
    {
      id: "question-1",
      question: "Question?",
      reason: "Reason",
      priority: "high",
    },
  ],
  confidence: 0.9,
};

test("normalization strips evidence and creates an approved Project Model", () => {
  const model = normalizeAgentProjectModel({
    projectId: "project-1",
    output,
    generatedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  });

  assert.equal(model.status, "approved");
  assert.equal(model.projectId, "project-1");
  assert.equal(
    "evidence" in model.requirements[0],
    false
  );
  assert.equal(model.requirements.length, 1);
  assert.equal(model.assumptions.length, 1);
  assert.equal(model.domainEntities.length, 1);
  assert.equal(model.risks.length, 1);
  assert.equal(model.openQuestions.length, 1);
});
