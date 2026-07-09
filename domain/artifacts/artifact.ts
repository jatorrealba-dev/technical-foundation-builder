export type ArtifactType =
  | "product_spec"
  | "mvp_scope"
  | "domain_model"
  | "architecture"
  | "data_model"
  | "security"
  | "backlog"
  | "vertical_slice_plan";

export type ArtifactFormat = "markdown";

export type GeneratedArtifact = {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  filename: string;
  format: ArtifactFormat;
  content: string;
  createdAt: string;
  updatedAt: string;
};
