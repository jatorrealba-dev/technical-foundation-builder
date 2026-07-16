import type { ProjectModel } from "@/domain/project-model/project-model";

export type CollectionDiff = {
  added: number;
  modified: number;
  removed: number;
  addedIds: string[];
  modifiedIds: string[];
  removedIds: string[];
};

export type ProjectModelDiff = {
  requirements: CollectionDiff;
  assumptions: CollectionDiff;
  domainEntities: CollectionDiff;
  risks: CollectionDiff;
  openQuestions: CollectionDiff;
  statusChanged: boolean;
  totalChanges: number;
};

type IdentifiedValue = {
  id: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            key !== "sourceQuestionId"
        )
        .sort(([left], [right]) =>
          left.localeCompare(right)
        )
        .map(([key, child]) => [
          key,
          stableValue(child),
        ])
    );
  }

  return value;
}

function valuesEqual(
  left: unknown,
  right: unknown
): boolean {
  return (
    JSON.stringify(stableValue(left)) ===
    JSON.stringify(stableValue(right))
  );
}

function compareCollections<T extends IdentifiedValue>(
  current: readonly T[],
  proposed: readonly T[]
): CollectionDiff {
  const currentById = new Map(
    current.map((item) => [item.id, item])
  );

  const proposedById = new Map(
    proposed.map((item) => [item.id, item])
  );

  const addedIds: string[] = [];
  const modifiedIds: string[] = [];
  const removedIds: string[] = [];

  for (const [id, item] of proposedById) {
    const existing = currentById.get(id);

    if (!existing) {
      addedIds.push(id);
      continue;
    }

    if (!valuesEqual(existing, item)) {
      modifiedIds.push(id);
    }
  }

  for (const id of currentById.keys()) {
    if (!proposedById.has(id)) {
      removedIds.push(id);
    }
  }

  return {
    added: addedIds.length,
    modified: modifiedIds.length,
    removed: removedIds.length,
    addedIds,
    modifiedIds,
    removedIds,
  };
}

function countCollectionChanges(
  diff: CollectionDiff
): number {
  return (
    diff.added +
    diff.modified +
    diff.removed
  );
}

export function compareProjectModels(
  current: ProjectModel,
  proposed: ProjectModel
): ProjectModelDiff {
  const requirements = compareCollections(
    current.requirements,
    proposed.requirements
  );

  const assumptions = compareCollections(
    current.assumptions,
    proposed.assumptions
  );

  const domainEntities = compareCollections(
    current.domainEntities,
    proposed.domainEntities
  );

  const risks = compareCollections(
    current.risks,
    proposed.risks
  );

  const openQuestions = compareCollections(
    current.openQuestions,
    proposed.openQuestions
  );

  const statusChanged =
    current.status !== proposed.status;

  return {
    requirements,
    assumptions,
    domainEntities,
    risks,
    openQuestions,
    statusChanged,
    totalChanges:
      countCollectionChanges(requirements) +
      countCollectionChanges(assumptions) +
      countCollectionChanges(domainEntities) +
      countCollectionChanges(risks) +
      countCollectionChanges(openQuestions) +
      (statusChanged ? 1 : 0),
  };
}
