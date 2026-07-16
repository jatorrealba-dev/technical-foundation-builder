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
import { generateArtifactPayloads } from "@/services/artifacts/generate-artifact-payloads";

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

type ProjectModelVersionRow = {
  id: string;
  project_id: string;
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
  created_at: string;
};

type RestoreRpcResult = {
  ok: boolean;
  error?: string;
  restoredFromVersion?: number;
  newVersion?: number;
};

function mapProject(
  row: ProjectRow
): FoundationProject {
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

function mapVersionToProjectModel(
  row: ProjectModelVersionRow
): ProjectModel {
  return {
    projectId: row.project_id,
    status: row.status,
    requirements: row.requirements,
    assumptions: row.assumptions,
    domainEntities: row.domain_entities,
    risks: row.risks,
    openQuestions: row.open_questions,
    generatedAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function parseRestoreResult(
  value: unknown
): RestoreRpcResult {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {
      ok: false,
      error:
        "La base de datos devolvió una respuesta de restauración no válida.",
    };
  }

  const record = value as Record<string, unknown>;

  return {
    ok: record.ok === true,
    error:
      typeof record.error === "string"
        ? record.error
        : undefined,
    restoredFromVersion:
      typeof record.restoredFromVersion === "number"
        ? record.restoredFromVersion
        : undefined,
    newVersion:
      typeof record.newVersion === "number"
        ? record.newVersion
        : undefined,
  };
}

export async function restoreProjectModelVersionFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const versionId = String(
    formData.get("versionId") ?? ""
  ).trim();

  const confirmed =
    String(
      formData.get("confirmRestore") ?? ""
    ) === "on";

  if (!projectId) {
    redirect("/dashboard");
  }

  const historyPath =
    `/projects/${projectId}/analysis/history`;

  if (!versionId || !confirmed) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        "Debes seleccionar y confirmar la versión que deseas restaurar."
      )}`
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
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
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        projectError.message
      )}`
    );
  }

  if (!projectData) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        "El proyecto no existe o no tienes acceso."
      )}`
    );
  }

  const {
    data: versionData,
    error: versionError,
  } = await supabase
    .from("project_model_versions")
    .select(
      "id, project_id, status, requirements, assumptions, domain_entities, risks, open_questions, created_at"
    )
    .eq("id", versionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (versionError) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        versionError.message
      )}`
    );
  }

  if (!versionData) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        "La versión seleccionada no existe o no pertenece al proyecto."
      )}`
    );
  }

  const project = mapProject(
    projectData as unknown as ProjectRow
  );

  const restoredModel =
    mapVersionToProjectModel(
      versionData as unknown as ProjectModelVersionRow
    );

  const restoredAt = new Date().toISOString();

  const artifacts = generateArtifactPayloads({
    project,
    model: {
      ...restoredModel,
      updatedAt: restoredAt,
    },
    updatedAt: restoredAt,
  });

  const {
    data: rpcData,
    error: rpcError,
  } = await supabase.rpc(
    "restore_project_model_version",
    {
      target_project_id: projectId,
      target_version_id: versionId,
      target_artifacts: artifacts,
    }
  );

  if (rpcError) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        `No se pudo restaurar la versión de forma transaccional: ${rpcError.message}`
      )}`
    );
  }

  const result = parseRestoreResult(rpcData);

  if (!result.ok) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        result.error ??
          "No se pudo restaurar la versión."
      )}`
    );
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/analysis`);
  revalidatePath(historyPath);
  revalidatePath(`/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}/agents`);

  redirect(
    `${historyPath}?restored=${encodeURIComponent(
      String(result.restoredFromVersion ?? "")
    )}&current=${encodeURIComponent(
      String(result.newVersion ?? "")
    )}`
  );
}
