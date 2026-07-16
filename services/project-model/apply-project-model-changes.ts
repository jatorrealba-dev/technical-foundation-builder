import type { ProjectModel } from "@/domain/project-model/project-model";
import type { ProjectModelChange } from "@/domain/project-model/project-model-governance";

function applyCollectionChanges<T extends { id: string }>(input: {
  current: readonly T[];
  changes: readonly ProjectModelChange[];
}): T[] {
  const byId = new Map(
    input.current.map((item) => [item.id, item])
  );

  for (const change of input.changes) {
    if (change.operation === "remove") {
      byId.delete(change.entityKey);
      continue;
    }

    if (!change.afterValue) {
      throw new Error(
        `El cambio ${change.entityKey} no contiene un valor propuesto.`
      );
    }

    byId.set(
      change.entityKey,
      change.afterValue as T
    );
  }

  return [...byId.values()];
}

export function applyProjectModelChanges(input: {
  current: ProjectModel;
  changes: readonly ProjectModelChange[];
  updatedAt?: string;
}): ProjectModel {
  const acceptedChanges = input.changes.filter(
    (change) =>
      change.decision === undefined ||
      change.decision === "accepted"
  );

  const byCategory = {
    requirement: acceptedChanges.filter(
      (change) => change.category === "requirement"
    ),
    assumption: acceptedChanges.filter(
      (change) => change.category === "assumption"
    ),
    domain_entity: acceptedChanges.filter(
      (change) => change.category === "domain_entity"
    ),
    risk: acceptedChanges.filter(
      (change) => change.category === "risk"
    ),
    open_question: acceptedChanges.filter(
      (change) => change.category === "open_question"
    ),
    model_status: acceptedChanges.filter(
      (change) => change.category === "model_status"
    ),
  };

  const statusChange = byCategory.model_status.at(-1);
  const statusValue = statusChange?.afterValue?.value;

  return {
    ...input.current,
    status:
      typeof statusValue === "string"
        ? statusValue as ProjectModel["status"]
        : input.current.status,
    requirements: applyCollectionChanges({
      current: input.current.requirements,
      changes: byCategory.requirement,
    }),
    assumptions: applyCollectionChanges({
      current: input.current.assumptions,
      changes: byCategory.assumption,
    }),
    domainEntities: applyCollectionChanges({
      current: input.current.domainEntities,
      changes: byCategory.domain_entity,
    }),
    risks: applyCollectionChanges({
      current: input.current.risks,
      changes: byCategory.risk,
    }),
    openQuestions: applyCollectionChanges({
      current: input.current.openQuestions,
      changes: byCategory.open_question,
    }),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}
