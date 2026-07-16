import type { ArtifactType } from "@/domain/artifacts/artifact";

export const projectModelChangeCategories = [
  "requirement",
  "assumption",
  "domain_entity",
  "risk",
  "open_question",
  "model_status",
] as const;

export type ProjectModelChangeCategory =
  (typeof projectModelChangeCategories)[number];

export const projectModelChangeOperations = [
  "add",
  "update",
  "remove",
] as const;

export type ProjectModelChangeOperation =
  (typeof projectModelChangeOperations)[number];

export const projectModelChangeDecisions = [
  "pending",
  "accepted",
  "rejected",
] as const;

export type ProjectModelChangeDecision =
  (typeof projectModelChangeDecisions)[number];

export const projectModelChangeSetStatuses = [
  "draft",
  "reviewing",
  "ready",
  "applied",
  "rejected",
  "cancelled",
] as const;

export type ProjectModelChangeSetStatus =
  (typeof projectModelChangeSetStatuses)[number];

export type ProjectModelChange = {
  id?: string;
  category: ProjectModelChangeCategory;
  operation: ProjectModelChangeOperation;
  entityKey: string;
  label: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  decision?: ProjectModelChangeDecision;
  reviewerComment?: string | null;
  impactedArtifactTypes: ArtifactType[];
};

export type ProjectModelChangeSetSummary = {
  total: number;
  added: number;
  updated: number;
  removed: number;
  impactedArtifactTypes: ArtifactType[];
  byCategory: Record<ProjectModelChangeCategory, number>;
};

export function isProjectModelChangeDecision(
  value: string
): value is ProjectModelChangeDecision {
  return projectModelChangeDecisions.includes(
    value as ProjectModelChangeDecision
  );
}
