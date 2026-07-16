import assert from "node:assert/strict";
import test from "node:test";

import { compareProjectModels } from "../services/project-model/compare-project-models.ts";

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

test("diff detects added, modified and removed items", () => {
  const current = createModel({
    requirements: [
      {
        id: "req-1",
        title: "Current",
        description: "Current description",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
      {
        id: "req-remove",
        title: "Remove",
        description: "Remove me",
        type: "functional",
        priority: "could",
        status: "proposed",
      },
    ],
  });

  const proposed = createModel({
    status: "approved",
    requirements: [
      {
        id: "req-1",
        title: "Updated",
        description: "Current description",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
      {
        id: "req-add",
        title: "Added",
        description: "New requirement",
        type: "security",
        priority: "must",
        status: "proposed",
      },
    ],
  });

  const diff = compareProjectModels(
    current,
    proposed
  );

  assert.deepEqual(
    diff.requirements.addedIds,
    ["req-add"]
  );
  assert.deepEqual(
    diff.requirements.modifiedIds,
    ["req-1"]
  );
  assert.deepEqual(
    diff.requirements.removedIds,
    ["req-remove"]
  );
  assert.equal(diff.statusChanged, true);
  assert.equal(diff.totalChanges, 4);
});

test("sourceQuestionId does not create a false modification", () => {
  const current = createModel({
    requirements: [
      {
        id: "req-1",
        title: "Requirement",
        description: "Same",
        type: "functional",
        priority: "must",
        status: "confirmed",
        sourceQuestionId: "question-1",
      },
    ],
  });

  const proposed = createModel({
    requirements: [
      {
        id: "req-1",
        title: "Requirement",
        description: "Same",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
    ],
  });

  const diff = compareProjectModels(
    current,
    proposed
  );

  assert.equal(diff.totalChanges, 0);
});
