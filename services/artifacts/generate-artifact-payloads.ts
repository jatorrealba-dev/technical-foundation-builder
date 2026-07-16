import { artifactCatalog } from "@/domain/artifacts/artifact-catalog";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { FoundationProject } from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { generateArchitectureMarkdown } from "@/services/artifacts/generate-architecture";
import { generateBacklogMarkdown } from "@/services/artifacts/generate-backlog";
import { generateDataModelMarkdown } from "@/services/artifacts/generate-data-model";
import { generateDomainModelMarkdown } from "@/services/artifacts/generate-domain-model";
import { generateMvpScopeMarkdown } from "@/services/artifacts/generate-mvp-scope";
import { generateProductSpecMarkdown } from "@/services/artifacts/generate-product-spec";
import { generateSecurityMarkdown } from "@/services/artifacts/generate-security";
import { generateVerticalSlicePlanMarkdown } from "@/services/artifacts/generate-vertical-slice-plan";

type ArtifactGenerator = (input: {
  project: FoundationProject;
  model: ProjectModel;
}) => string;

export type ArtifactWritePayload = {
  project_id: string;
  type: ArtifactType;
  title: string;
  filename: string;
  format: "markdown";
  content: string;
  updated_at: string;
};

const artifactGenerators: Record<
  ArtifactType,
  ArtifactGenerator
> = {
  product_spec: generateProductSpecMarkdown,
  mvp_scope: generateMvpScopeMarkdown,
  domain_model: generateDomainModelMarkdown,
  architecture: generateArchitectureMarkdown,
  data_model: generateDataModelMarkdown,
  security: generateSecurityMarkdown,
  backlog: generateBacklogMarkdown,
  vertical_slice_plan:
    generateVerticalSlicePlanMarkdown,
};

export function generateArtifactContent(input: {
  type: ArtifactType;
  project: FoundationProject;
  model: ProjectModel;
}): string {
  return artifactGenerators[input.type]({
    project: input.project,
    model: input.model,
  });
}

export function generateArtifactPayloadsForTypes(input: {
  project: FoundationProject;
  model: ProjectModel;
  types: readonly ArtifactType[];
  updatedAt?: string;
}): ArtifactWritePayload[] {
  const updatedAt =
    input.updatedAt ?? new Date().toISOString();

  const selectedTypes = new Set(input.types);

  return artifactCatalog
    .filter((definition) => selectedTypes.has(definition.type))
    .map((definition) => ({
      project_id: input.project.id,
      type: definition.type,
      title: definition.title,
      filename: definition.filename,
      format: "markdown",
      content: generateArtifactContent({
        type: definition.type,
        project: input.project,
        model: input.model,
      }),
      updated_at: updatedAt,
    }));
}

export function generateArtifactPayloads(input: {
  project: FoundationProject;
  model: ProjectModel;
  updatedAt?: string;
}): ArtifactWritePayload[] {
  return generateArtifactPayloadsForTypes({
    ...input,
    types: artifactCatalog.map((definition) => definition.type),
  });
}
