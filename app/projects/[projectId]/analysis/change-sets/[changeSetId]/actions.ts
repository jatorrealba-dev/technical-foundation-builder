"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ArtifactType } from "@/domain/artifacts/artifact";
import type {
  FoundationProject,
  ProductType,
  ProjectStatus,
  TechnicalLevel,
} from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import {
  isProjectModelChangeDecision,
  type ProjectModelChange,
} from "@/domain/project-model/project-model-governance";
import { createClient } from "@/lib/supabase/server";
import { generateArtifactPayloadsForTypes } from "@/services/artifacts/generate-artifact-payloads";
import { applyProjectModelChanges } from "@/services/project-model/apply-project-model-changes";
import { getImpactedArtifactTypes } from "@/services/project-model/artifact-impact";

type ProjectRow = {
  id: string;
  organization_id: string;
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

type ChangeRow = {
  id: string;
  category: ProjectModelChange["category"];
  operation: ProjectModelChange["operation"];
  entity_key: string;
  label: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  decision: ProjectModelChange["decision"];
  reviewer_comment: string | null;
  impacted_artifact_types: ArtifactType[];
};

type RpcResult = {
  ok: boolean;
  error?: string;
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
  };
}

function getChangeSetPath(
  projectId: string,
  changeSetId: string
): string {
  return `/projects/${projectId}/analysis/change-sets/${changeSetId}`;
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

function revalidateGovernancePaths(
  projectId: string,
  changeSetId: string
): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/analysis`);
  revalidatePath(`/projects/${projectId}/analysis/history`);
  revalidatePath(`/projects/${projectId}/analysis/change-sets`);
  revalidatePath(getChangeSetPath(projectId, changeSetId));
  revalidatePath(`/projects/${projectId}/documents`);
}

export async function reviewProjectModelChangeFormAction(
  formData: FormData
) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const changeSetId = String(formData.get("changeSetId") ?? "").trim();
  const changeId = String(formData.get("changeId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const comment = String(formData.get("reviewerComment") ?? "").trim();

  if (!projectId) redirect("/dashboard");

  const path = getChangeSetPath(projectId, changeSetId);

  if (!changeSetId || !changeId || !isProjectModelChangeDecision(decision) || decision === "pending") {
    redirect(
      `${path}?error=${encodeURIComponent("La decisión del cambio no es válida.")}`
    );
  }

  if (comment.length > 4000) {
    redirect(
      `${path}?error=${encodeURIComponent("El comentario no puede superar 4000 caracteres.")}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "review_project_model_change",
    {
      target_change_set_id: changeSetId,
      target_change_id: changeId,
      target_decision: decision,
      target_comment: comment || null,
    }
  );

  if (error) {
    redirect(
      `${path}?error=${encodeURIComponent(error.message)}`
    );
  }

  const result = getRpcResult(data);

  if (!result.ok) {
    redirect(
      `${path}?error=${encodeURIComponent(result.error ?? "No se pudo guardar la decisión.")}`
    );
  }

  revalidateGovernancePaths(projectId, changeSetId);
  redirect(`${path}?reviewed=${encodeURIComponent(changeId)}`);
}

export async function applyProjectModelChangeSetFormAction(
  formData: FormData
) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const changeSetId = String(formData.get("changeSetId") ?? "").trim();
  const confirmed = String(formData.get("confirmApply") ?? "") === "on";

  if (!projectId) redirect("/dashboard");

  const path = getChangeSetPath(projectId, changeSetId);

  if (!changeSetId || !confirmed) {
    redirect(
      `${path}?error=${encodeURIComponent("Debes confirmar la aplicación de los cambios aceptados.")}`
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
      "id, organization_id, name, description, industry, product_type, technical_level, main_goal, status, created_at, updated_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectData) {
    redirect(
      `${path}?error=${encodeURIComponent(projectError?.message ?? "El proyecto no existe o no tienes acceso.")}`
    );
  }

  const { data: modelData, error: modelError } = await supabase
    .from("project_models")
    .select(
      "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (modelError || !modelData) {
    redirect(
      `${path}?error=${encodeURIComponent(modelError?.message ?? "No existe un Project Model vigente.")}`
    );
  }

  const { data: changeRows, error: changesError } = await supabase
    .from("project_model_changes")
    .select(
      "id, category, operation, entity_key, label, before_value, after_value, decision, reviewer_comment, impacted_artifact_types"
    )
    .eq("change_set_id", changeSetId)
    .eq("project_id", projectId)
    .eq("decision", "accepted")
    .order("display_order", { ascending: true });

  if (changesError) {
    redirect(
      `${path}?error=${encodeURIComponent(changesError.message)}`
    );
  }

  const acceptedChanges = (changeRows ?? []).map((row) => {
    const change = row as unknown as ChangeRow;

    return {
      id: change.id,
      category: change.category,
      operation: change.operation,
      entityKey: change.entity_key,
      label: change.label,
      beforeValue: change.before_value,
      afterValue: change.after_value,
      decision: change.decision,
      reviewerComment: change.reviewer_comment,
      impactedArtifactTypes: change.impacted_artifact_types,
    } satisfies ProjectModelChange;
  });

  if (acceptedChanges.length === 0) {
    redirect(
      `${path}?error=${encodeURIComponent("Debes aceptar al menos un cambio antes de aplicar.")}`
    );
  }

  const now = new Date().toISOString();
  const currentModel = mapModel(
    modelData as unknown as ProjectModelRow
  );
  const resultingModel = applyProjectModelChanges({
    current: currentModel,
    changes: acceptedChanges,
    updatedAt: now,
  });
  const impactedTypes = getImpactedArtifactTypes(acceptedChanges);
  const artifacts = generateArtifactPayloadsForTypes({
    project: mapProject(projectData as unknown as ProjectRow),
    model: resultingModel,
    types: impactedTypes,
    updatedAt: now,
  });

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "apply_project_model_change_set",
    {
      target_change_set_id: changeSetId,
      target_model: {
        status: resultingModel.status,
        requirements: resultingModel.requirements,
        assumptions: resultingModel.assumptions,
        domainEntities: resultingModel.domainEntities,
        risks: resultingModel.risks,
        openQuestions: resultingModel.openQuestions,
      },
      target_artifacts: artifacts,
      target_impacted_artifact_types: impactedTypes,
    }
  );

  if (rpcError) {
    redirect(
      `${path}?error=${encodeURIComponent(`No se pudo aplicar la propuesta: ${rpcError.message}`)}`
    );
  }

  const result = getRpcResult(rpcData);

  if (!result.ok) {
    redirect(
      `${path}?error=${encodeURIComponent(result.error ?? "No se pudo aplicar la propuesta.")}`
    );
  }

  revalidateGovernancePaths(projectId, changeSetId);
  redirect(`${path}?applied=1`);
}

export async function closeProjectModelChangeSetFormAction(
  formData: FormData
) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const changeSetId = String(formData.get("changeSetId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!projectId) redirect("/dashboard");

  const path = getChangeSetPath(projectId, changeSetId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "close_project_model_change_set",
    {
      target_change_set_id: changeSetId,
      target_reason: reason || null,
    }
  );

  if (error) {
    redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  }

  const result = getRpcResult(data);

  if (!result.ok) {
    redirect(
      `${path}?error=${encodeURIComponent(result.error ?? "No se pudo cerrar la propuesta.")}`
    );
  }

  revalidateGovernancePaths(projectId, changeSetId);
  redirect(`${path}?closed=1`);
}
