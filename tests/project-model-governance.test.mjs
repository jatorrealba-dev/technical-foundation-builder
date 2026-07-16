import assert from "node:assert/strict";
import test from "node:test";

import { applyProjectModelChanges } from "../services/project-model/apply-project-model-changes.ts";
import { getImpactedArtifactTypes } from "../services/project-model/artifact-impact.ts";
import {
  createProjectModelChanges,
  summarizeProjectModelChanges,
} from "../services/project-model/create-project-model-changes.ts";

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

test("governance creates granular add, update, remove and status changes", () => {
  const current = createModel({
    requirements: [
      {
        id: "req-update",
        title: "Current",
        description: "Current description",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
      {
        id: "req-remove",
        title: "Remove",
        description: "Remove description",
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
        id: "req-update",
        title: "Updated",
        description: "Current description",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
      {
        id: "req-add",
        title: "Added",
        description: "New description",
        type: "security",
        priority: "must",
        status: "proposed",
      },
    ],
  });

  const changes = createProjectModelChanges({ current, proposed });
  const summary = summarizeProjectModelChanges(changes);

  assert.equal(changes.length, 4);
  assert.equal(changes[0].category, "model_status");
  assert.equal(summary.added, 1);
  assert.equal(summary.updated, 2);
  assert.equal(summary.removed, 1);
  assert.equal(summary.byCategory.requirement, 3);
  assert.equal(summary.byCategory.model_status, 1);
  assert.ok(summary.impactedArtifactTypes.includes("data_model"));
});

test("application merges only accepted granular changes", () => {
  const current = createModel({
    requirements: [
      {
        id: "req-1",
        title: "Current",
        description: "Description",
        type: "functional",
        priority: "must",
        status: "confirmed",
      },
    ],
  });

  const resulting = applyProjectModelChanges({
    current,
    changes: [
      {
        category: "requirement",
        operation: "update",
        entityKey: "req-1",
        label: "Updated requirement",
        beforeValue: current.requirements[0],
        afterValue: {
          ...current.requirements[0],
          title: "Accepted update",
        },
        decision: "accepted",
        impactedArtifactTypes: ["product_spec"],
      },
      {
        category: "risk",
        operation: "add",
        entityKey: "risk-1",
        label: "Rejected risk",
        beforeValue: null,
        afterValue: {
          id: "risk-1",
          title: "Rejected risk",
          description: "Should not be applied",
          probability: "low",
          impact: "low",
          mitigation: "None",
        },
        decision: "rejected",
        impactedArtifactTypes: ["security"],
      },
    ],
  });

  assert.equal(resulting.requirements[0].title, "Accepted update");
  assert.equal(resulting.risks.length, 0);
});

test("artifact impact is the deduplicated union of accepted changes", () => {
  const types = getImpactedArtifactTypes([
    {
      category: "requirement",
      impactedArtifactTypes: ["product_spec", "backlog"],
    },
    {
      category: "risk",
      impactedArtifactTypes: ["backlog", "security"],
    },
  ]);

  assert.deepEqual(types, ["backlog", "product_spec", "security"]);
});
