"use server";

import { revalidatePath } from "next/cache";

import {
  getArtifactDefinition,
} from "@/domain/artifacts/artifact-catalog";
import type {
  ArtifactType,
  GeneratedArtifact,
} from "@/domain/artifacts/artifact";
import type {
  FoundationProject,
  ProductType,
  ProjectStatus,
  TechnicalLevel,
} from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import {
  generateArtifactContent,
  generateArtifactPayloads,
} from "@/services/artifacts/generate-artifact-payloads";

type GenerateDocumentInput = {
  projectId: string;
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

export type GeneratePackageResult =
  | {
      ok: true;
      artifacts: GeneratedArtifact[];
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

function revalidateProjectDocuments(
  projectId: string
): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(
    `/projects/${projectId}/documents`
  );
}

async function loadGenerationContext(
  projectId: string
) {
  if (!projectId) {
    return {
      ok: false as const,
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
      ok: false as const,
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
      ok: false as const,
      error: projectError.message,
    };
  }

  if (!projectData) {
    return {
      ok: false as const,
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
      ok: false as const,
      error: modelError.message,
    };
  }

  if (!modelData) {
    return {
      ok: false as const,
      error:
        "Primero debes generar el análisis inicial del proyecto antes de crear documentos.",
    };
  }

  return {
    ok: true as const,
    supabase,
    project: mapProject(
      projectData as unknown as ProjectRow
    ),
    model: mapProjectModel(
      modelData as unknown as ProjectModelRow
    ),
  };
}

async function generateDocument(
  input: GenerateDocumentInput,
  artifactType: ArtifactType
): Promise<GenerateDocumentResult> {
  const projectId = input.projectId.trim();

  const context =
    await loadGenerationContext(projectId);

  if (!context.ok) {
    return context;
  }

  const definition =
    getArtifactDefinition(artifactType);

  const content = generateArtifactContent({
    type: artifactType,
    project: context.project,
    model: context.model,
  });

  const now = new Date().toISOString();

  const {
    data: artifactData,
    error: artifactError,
  } = await context.supabase
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

  revalidateProjectDocuments(projectId);

  return {
    ok: true,
    artifact,
  };
}

export async function generatePackageAction(
  input: GenerateDocumentInput
): Promise<GeneratePackageResult> {
  const projectId = input.projectId.trim();

  const context =
    await loadGenerationContext(projectId);

  if (!context.ok) {
    return context;
  }

  const now = new Date().toISOString();

  const artifactPayloads = generateArtifactPayloads({
    project: context.project,
    model: context.model,
    updatedAt: now,
  });

  const {
    data: artifactRows,
    error: artifactsError,
  } = await context.supabase
    .from("artifacts")
    .upsert(artifactPayloads, {
      onConflict: "project_id,type",
    })
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    );

  if (artifactsError) {
    return {
      ok: false,
      error: artifactsError.message,
    };
  }

  const artifacts = (
    (artifactRows ?? []) as unknown as ArtifactRow[]
  ).map(mapArtifact);

  revalidateProjectDocuments(projectId);

  return {
    ok: true,
    artifacts,
  };
}

export async function generateProductSpecAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "product_spec"
  );
}

export async function generateMvpScopeAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "mvp_scope"
  );
}

export async function generateDomainModelAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "domain_model"
  );
}

export async function generateArchitectureAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "architecture"
  );
}

export async function generateDataModelAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "data_model"
  );
}

export async function generateSecurityAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "security"
  );
}

export async function generateBacklogAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "backlog"
  );
}

export async function generateVerticalSlicePlanAction(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  return generateDocument(
    input,
    "vertical_slice_plan"
  );
}
