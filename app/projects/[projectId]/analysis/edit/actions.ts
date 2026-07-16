"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  FoundationProject,
  ProductType,
  ProjectStatus,
  TechnicalLevel,
} from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import { editableProjectModelSchema } from "@/schemas/project-model/project-model";
import { generateArtifactPayloadsForTypes } from "@/services/artifacts/generate-artifact-payloads";
import { getImpactedArtifactTypes } from "@/services/project-model/artifact-impact";
import {
  createProjectModelChanges,
  summarizeProjectModelChanges,
} from "@/services/project-model/create-project-model-changes";

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

type RpcResult = {
  ok: boolean;
  error?: string;
  changeSetId?: string;
};

function getRpcResult(value: unknown): RpcResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      error: "La base de datos devolvió una respuesta no válida.",
    };
  }

  const record = value as Record<string, unknown>;

  return {
    ok: record.ok === true,
    error:
      typeof record.error === "string"
        ? record.error
        : undefined,
    changeSetId:
      typeof record.changeSetId === "string"
        ? record.changeSetId
        : undefined,
  };
}

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

function mapModel(row: ProjectModelRow): ProjectModel {
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

export async function saveProjectModelFormAction(
  formData: FormData
) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const baseModelVersionId = String(
    formData.get("baseModelVersionId") ?? ""
  ).trim();
  const payload = String(formData.get("modelPayload") ?? "").trim();
  const changeReason = String(formData.get("changeReason") ?? "").trim();

  if (!projectId) redirect("/dashboard");

  const editPath = `/projects/${projectId}/analysis/edit`;

  if (!payload) {
    redirect(
      `${editPath}?error=${encodeURIComponent("El contenido del Project Model es obligatorio.")}`
    );
  }

  if (changeReason.length < 3 || changeReason.length > 1000) {
    redirect(
      `${editPath}?error=${encodeURIComponent("Describe el motivo del cambio entre 3 y 1000 caracteres.")}`
    );
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(payload);
  } catch {
    redirect(
      `${editPath}?error=${encodeURIComponent("El editor produjo un JSON inválido.")}`
    );
  }

  const parsed = editableProjectModelSchema.safeParse(decoded);

  if (!parsed.success) {
    redirect(
      `${editPath}?error=${encodeURIComponent(`El Project Model no es válido: ${parsed.error.issues[0]?.message ?? "estructura incorrecta"}`)}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, industry, product_type, technical_level, main_goal, status, created_at, updated_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectData) {
    redirect(
      `${editPath}?error=${encodeURIComponent(projectError?.message ?? "El proyecto no existe o no tienes acceso.")}`
    );
  }

  const { data: currentData, error: currentError } = await supabase
    .from("project_models")
    .select(
      "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (currentError || !currentData) {
    redirect(
      `${editPath}?error=${encodeURIComponent(currentError?.message ?? "No existe un Project Model para editar.")}`
    );
  }

  const currentModel = mapModel(
    currentData as unknown as ProjectModelRow
  );
  const now = new Date().toISOString();
  const proposedModel: ProjectModel = {
    projectId,
    status: parsed.data.status,
    requirements: parsed.data.requirements,
    assumptions: parsed.data.assumptions,
    domainEntities: parsed.data.domainEntities,
    risks: parsed.data.risks,
    openQuestions: parsed.data.openQuestions,
    generatedAt: currentModel.generatedAt,
    updatedAt: now,
  };

  const changes = createProjectModelChanges({
    current: currentModel,
    proposed: proposedModel,
  });

  if (changes.length === 0) {
    redirect(
      `${editPath}?error=${encodeURIComponent("No se detectaron cambios para guardar.")}`
    );
  }

  const summary = summarizeProjectModelChanges(changes);
  const impactedTypes = getImpactedArtifactTypes(changes);
  const artifacts = generateArtifactPayloadsForTypes({
    project: mapProject(projectData as unknown as ProjectRow),
    model: proposedModel,
    types: impactedTypes,
    updatedAt: now,
  });

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_and_apply_manual_project_model_change_set",
    {
      target_project_id: projectId,
      target_base_model_version_id: baseModelVersionId || null,
      target_title: `Edición manual · ${
        (projectData as unknown as ProjectRow).name
      }`,
      target_reason: changeReason,
      target_summary: summary,
      target_changes: changes,
      target_model: {
        status: proposedModel.status,
        requirements: proposedModel.requirements,
        assumptions: proposedModel.assumptions,
        domainEntities: proposedModel.domainEntities,
        risks: proposedModel.risks,
        openQuestions: proposedModel.openQuestions,
      },
      target_artifacts: artifacts,
      target_impacted_artifact_types: impactedTypes,
    }
  );

  if (rpcError) {
    redirect(
      `${editPath}?error=${encodeURIComponent(`No se pudo guardar el Project Model: ${rpcError.message}`)}`
    );
  }

  const result = getRpcResult(rpcData);

  if (!result.ok) {
    redirect(
      `${editPath}?error=${encodeURIComponent(result.error ?? "No se pudo guardar el Project Model.")}`
    );
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/analysis`);
  revalidatePath(`/projects/${projectId}/analysis/history`);
  revalidatePath(`/projects/${projectId}/analysis/change-sets`);
  revalidatePath(`/projects/${projectId}/documents`);

  redirect(
    `/projects/${projectId}/analysis?updated=1${
      result.changeSetId
        ? `&changeSet=${encodeURIComponent(result.changeSetId)}`
        : ""
    }`
  );
}
