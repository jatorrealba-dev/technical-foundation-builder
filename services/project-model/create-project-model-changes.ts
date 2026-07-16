import type { ProjectModel } from "@/domain/project-model/project-model";
import type {
  ProjectModelChange,
  ProjectModelChangeCategory,
  ProjectModelChangeSetSummary,
} from "@/domain/project-model/project-model-governance";
import {
  getArtifactImpactForCategory,
  getImpactedArtifactTypes,
} from "./artifact-impact.ts";

type IdentifiedValue = {
  id: string;
};

type CollectionDefinition = {
  category: ProjectModelChangeCategory;
  current: IdentifiedValue[];
  proposed: IdentifiedValue[];
  getLabel: (value: IdentifiedValue) => string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceQuestionId")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }

  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(stableValue(left)) ===
    JSON.stringify(stableValue(right))
  );
}

function asRecord(value: IdentifiedValue): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function compareCollection(
  definition: CollectionDefinition
): ProjectModelChange[] {
  const currentById = new Map(
    definition.current.map((item) => [item.id, item])
  );
  const proposedById = new Map(
    definition.proposed.map((item) => [item.id, item])
  );
  const impact = getArtifactImpactForCategory(definition.category);
  const changes: ProjectModelChange[] = [];

  for (const proposed of definition.proposed) {
    const current = currentById.get(proposed.id);

    if (!current) {
      changes.push({
        category: definition.category,
        operation: "add",
        entityKey: proposed.id,
        label: definition.getLabel(proposed),
        beforeValue: null,
        afterValue: asRecord(proposed),
        impactedArtifactTypes: impact,
      });
      continue;
    }

    if (!valuesEqual(current, proposed)) {
      changes.push({
        category: definition.category,
        operation: "update",
        entityKey: proposed.id,
        label: definition.getLabel(proposed),
        beforeValue: asRecord(current),
        afterValue: asRecord(proposed),
        impactedArtifactTypes: impact,
      });
    }
  }

  for (const current of definition.current) {
    if (!proposedById.has(current.id)) {
      changes.push({
        category: definition.category,
        operation: "remove",
        entityKey: current.id,
        label: definition.getLabel(current),
        beforeValue: asRecord(current),
        afterValue: null,
        impactedArtifactTypes: impact,
      });
    }
  }

  return changes;
}

export function createProjectModelChanges(input: {
  current: ProjectModel;
  proposed: ProjectModel;
}): ProjectModelChange[] {
  const definitions: CollectionDefinition[] = [
    {
      category: "requirement",
      current: input.current.requirements,
      proposed: input.proposed.requirements,
      getLabel: (value) => String((value as { title?: string }).title ?? value.id),
    },
    {
      category: "assumption",
      current: input.current.assumptions,
      proposed: input.proposed.assumptions,
      getLabel: (value) => String((value as { statement?: string }).statement ?? value.id),
    },
    {
      category: "domain_entity",
      current: input.current.domainEntities,
      proposed: input.proposed.domainEntities,
      getLabel: (value) => String((value as { name?: string }).name ?? value.id),
    },
    {
      category: "risk",
      current: input.current.risks,
      proposed: input.proposed.risks,
      getLabel: (value) => String((value as { title?: string }).title ?? value.id),
    },
    {
      category: "open_question",
      current: input.current.openQuestions,
      proposed: input.proposed.openQuestions,
      getLabel: (value) => String((value as { question?: string }).question ?? value.id),
    },
  ];

  const changes = definitions.flatMap(compareCollection);

  if (input.current.status !== input.proposed.status) {
    changes.unshift({
      category: "model_status",
      operation: "update",
      entityKey: "project-model-status",
      label: "Estado general del Project Model",
      beforeValue: { value: input.current.status },
      afterValue: { value: input.proposed.status },
      impactedArtifactTypes: getArtifactImpactForCategory("model_status"),
    });
  }

  return changes;
}

export function summarizeProjectModelChanges(
  changes: readonly ProjectModelChange[]
): ProjectModelChangeSetSummary {
  const byCategory: ProjectModelChangeSetSummary["byCategory"] = {
    requirement: 0,
    assumption: 0,
    domain_entity: 0,
    risk: 0,
    open_question: 0,
    model_status: 0,
  };

  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const change of changes) {
    byCategory[change.category] += 1;

    if (change.operation === "add") added += 1;
    if (change.operation === "update") updated += 1;
    if (change.operation === "remove") removed += 1;
  }

  return {
    total: changes.length,
    added,
    updated,
    removed,
    impactedArtifactTypes: getImpactedArtifactTypes(changes),
    byCategory,
  };
}
