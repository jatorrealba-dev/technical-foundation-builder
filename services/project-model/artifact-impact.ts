import type { ArtifactType } from "@/domain/artifacts/artifact";
import type {
  ProjectModelChange,
  ProjectModelChangeCategory,
} from "@/domain/project-model/project-model-governance";

const artifactImpactByCategory: Record<
  ProjectModelChangeCategory,
  readonly ArtifactType[]
> = {
  requirement: [
    "product_spec",
    "mvp_scope",
    "architecture",
    "security",
    "backlog",
    "vertical_slice_plan",
  ],
  assumption: [
    "product_spec",
    "mvp_scope",
    "architecture",
    "security",
    "backlog",
  ],
  domain_entity: [
    "domain_model",
    "architecture",
    "data_model",
    "security",
  ],
  risk: [
    "product_spec",
    "architecture",
    "security",
    "backlog",
    "vertical_slice_plan",
  ],
  open_question: [
    "product_spec",
    "mvp_scope",
    "architecture",
    "security",
    "backlog",
  ],
  model_status: [
    "product_spec",
    "mvp_scope",
    "domain_model",
    "architecture",
    "data_model",
    "security",
    "backlog",
    "vertical_slice_plan",
  ],
};

export function getArtifactImpactForCategory(
  category: ProjectModelChangeCategory
): ArtifactType[] {
  return [...artifactImpactByCategory[category]];
}

export function getImpactedArtifactTypes(
  changes: readonly Pick<
    ProjectModelChange,
    "category" | "impactedArtifactTypes"
  >[]
): ArtifactType[] {
  const types = new Set<ArtifactType>();

  for (const change of changes) {
    const impact =
      change.impactedArtifactTypes.length > 0
        ? change.impactedArtifactTypes
        : getArtifactImpactForCategory(change.category);

    for (const type of impact) {
      types.add(type);
    }
  }

  return [...types].sort();
}
