"use server";

import { revalidatePath } from "next/cache";

import type { GeneratedArtifact } from "@/domain/artifacts/artifact";
import type {
  FoundationProject,
  ProductType,
  ProjectStatus,
  TechnicalLevel,
} from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import { generateArchitectureMarkdown } from "@/services/artifacts/generate-architecture";
import { generateDataModelMarkdown } from "@/services/artifacts/generate-data-model";
import { generateDomainModelMarkdown } from "@/services/artifacts/generate-domain-model";
import { generateMvpScopeMarkdown } from "@/services/artifacts/generate-mvp-scope";
import { generateProductSpecMarkdown } from "@/services/artifacts/generate-product-spec";

type GenerateDocumentInput = {
  projectId: string;
};

type SupportedArtifactType =
  | "product_spec"
  | "mvp_scope"
  | "domain_model"
  | "architecture"
  | "data_model";

type ArtifactDefinition = {
  type: SupportedArtifactType;
  title: string;
  filename: string;
  generateContent: (input: {
    project: FoundationProject;
    model: ProjectModel;
  }) => string;
};

export type GenerateDocumentResult =
  | {
      ok: true;
      artifact: GeneratedArtifact;
    }
  | {
      ok: false;
      error: string;
    };

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  industry: string;
  product_type: ProductType;
  technical_level: TechnicalLevel;
  main_goal: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type ProjectModelRow = {
  project_id: string;
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
  generated_at: string;
  updated_at: string;
};

type ArtifactRow = {
  id: string;
  project_id: string;
  type: GeneratedArtifact["type"];
  title: string;
  filename: string;
  format: GeneratedArtifact["format"];
  content: string;
  created_at: string;
  updated_at: string;
};

const productSpecDefinition: ArtifactDefinition = {
  type: "product_spec",
  title: "Product Spec",
  filename: "PRODUCT_SPEC.md",
  generateContent: generateProductSpecMarkdown,
};

const mvpScopeDefinition: ArtifactDefinition = {
  type: "mvp_scope",
  title: "MVP Scope",
  filename: "MVP_SCOPE.md",
  generateContent: generateMvpScopeMarkdown,
};

const domainModelDefinition: ArtifactDefinition = {
  type: "domain_model",
  title: "Domain Model",
  filename: "DOMAIN_MODEL.md",
  generateContent: generateDomainModelMarkdown,
};

const architectureDefinition: ArtifactDefinition = {
  type: "architecture",
  title: "Software Architecture",
  filename: "ARCHITECTURE.md",
  generateContent: generateArchitectureMarkdown,
};

const dataModelDefinition: ArtifactDefinition = {
  type: "data_model",
  title: "Data Model",
  filename: "DATA_MODEL.md",
  generateContent: generateDataModelMarkdown,
};

function mapProject(row: ProjectRow): FoundationProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    industry: row.industry,
    productType: row.product_type,
    technicalLevel: row.technical_level,
    mainGoal: row.main_goal,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectModel(
  row: ProjectModelRow
): ProjectModel {
  return {
    projectId: row.project_id,
    status: row.status,
    requirements: row.requirements,
    assumptions: row.assumptions,
    domainEntities: row.domain_entities,
    risks: row.risks,
    openQuestions: row.open_questions,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function mapArtifact(
  row: ArtifactRow
): GeneratedArtifact {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    filename: row.filename,
    format: row.format,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function generateDocument(
  input: GenerateDocumentInput,
  definition: ArtifactDefinition
): Promise<GenerateDocumentResult> {
  const projectId = input.projectId.trim();

  if (!projectId) {
    return {
      ok: false,
      error:
        "El identificador del proyecto es obligatorio.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error:
        "Debes iniciar sesión para generar documentos.",
    };
  }

  const {
    data: projectData,
    error: projectError,
  } = await supabase
    .from("projects")
    .select(
      "id, name, description, industry, product_type, technical_level, main_goal, status, created_at, updated_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return {
      ok: false,
      error: projectError.message,
    };
  }

  if (!projectData) {
    return {
      ok: false,
      error:
        "El proyecto no existe o no tienes acceso.",
    };
  }

  const {
    data: modelData,
    error: modelError,
  } = await supabase
    .from("project_models")
    .select(
      "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (modelError) {
    return {
      ok: false,
      error: modelError.message,
    };
  }

  if (!modelData) {
    return {
      ok: false,
      error:
        "Primero debes generar el análisis inicial del proyecto antes de crear documentos.",
    };
  }

  const project = mapProject(
    projectData as unknown as ProjectRow
  );

  const model = mapProjectModel(
    modelData as unknown as ProjectModelRow
  );

  const content = definition.generateContent({
    project,
    model,
  });

  const now = new Date().toISOString();

  const {
    data: artifactData,
    error: artifactError,
  } = await supabase
    .from("artifacts")
    .upsert(
      {
        project_id: projectId,
        type: definition.type,
        title: definition.title,
        filename: definition.filename,
        format: "markdown",
        content,
        updated_at: now,
      },
      {
        onConflict: "project_id,type",
      }
    )
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    )
    .single();

  if (artifactError) {
    return {
      ok: false,
      error: artifactError.message,
    };
  }

  const artifact = mapArtifact(
    artifactData as unknown as ArtifactRow
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(
    `/projects/${projectId}/documents`
  );

  return {
    ok: true,
    artifact,
  };
}

export async function generateProductSpecAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    productSpecDefinition
  );
}

export async function generateMvpScopeAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    mvpScopeDefinition
  );
}

export async function generateDomainModelAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    domainModelDefinition
  );
}

export async function generateArchitectureAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    architectureDefinition
  );
}

export async function generateDataModelAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    dataModelDefinition
  );
}
