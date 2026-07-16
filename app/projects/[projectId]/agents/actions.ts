"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isAgentKey,
  isAgentReviewDecision,
  type AgentApplicationStatus,
  type AgentKey,
  type AgentReviewDecision,
  type AgentRunStatus,
} from "@/domain/agents/agent";
import type {
  FoundationProject,
  ProductType,
  ProjectStatus,
  TechnicalLevel,
} from "@/domain/projects/project";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import { projectModelAgentOutputSchema } from "@/schemas/agents/agent-outputs";
import { executeProjectAgent } from "@/services/agents/run-project-agent";
import {
  createProjectModelChanges,
  summarizeProjectModelChanges,
} from "@/services/project-model/create-project-model-changes";
import { normalizeAgentProjectModel } from "@/services/project-model/normalize-agent-project-model";

type AgentRunRow = {
  id: string;
  project_id: string;
  agent_key: AgentKey;
  status: AgentRunStatus;
  output: unknown;
};

type ProjectAccessRow = {
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

type OrganizationMembershipRow = {
  role: string;
};

type AgentRunReviewRow = {
  id: string;
  run_id: string;
  project_id: string;
  decision: AgentReviewDecision;
  reviewer_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  application_status: AgentApplicationStatus;
  application_summary: Record<string, unknown>;
  applied_by: string | null;
  applied_at: string | null;
};


function mapProject(
  row: ProjectAccessRow
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

function getAgentsPath(projectId: string): string {
  return `/projects/${projectId}/agents`;
}

function revalidateAgentReviewPaths(
  projectId: string
): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(getAgentsPath(projectId));
  revalidatePath(`/projects/${projectId}/analysis`);
  revalidatePath(`/projects/${projectId}/documents`);
}

async function appendRunEvent(input: {
  runId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_run_events")
    .insert({
      run_id: input.runId,
      event_type: input.eventType,
      payload: input.payload ?? {},
    });

  if (error) {
    console.error(
      "No se pudo registrar el evento de revisión del agente.",
      error.message
    );
  }
}

async function loadAuthenticatedRun(input: {
  projectId: string;
  runId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      error: "Debes iniciar sesión para continuar.",
    };
  }

  const {
    data: projectData,
    error: projectError,
  } = await supabase
    .from("projects")
    .select(
      "id, organization_id, name, description, industry, product_type, technical_level, main_goal, status, created_at, updated_at"
    )
    .eq("id", input.projectId)
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
      error: "El proyecto no existe o no tienes acceso.",
    };
  }

  const project =
    projectData as unknown as ProjectAccessRow;

  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return {
      ok: false as const,
      error: membershipError.message,
    };
  }

  const membership = membershipData
    ? membershipData as unknown as OrganizationMembershipRow
    : null;

  const isAdmin =
    membership?.role === "owner" ||
    membership?.role === "admin";

  const {
    data: runData,
    error: runError,
  } = await supabase
    .from("agent_runs")
    .select("id, project_id, agent_key, status, output")
    .eq("id", input.runId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (runError) {
    return {
      ok: false as const,
      error: runError.message,
    };
  }

  if (!runData) {
    return {
      ok: false as const,
      error:
        "La ejecución no existe o no pertenece a este proyecto.",
    };
  }

  return {
    ok: true as const,
    supabase,
    user,
    isAdmin,
    project: mapProject(project),
    run: runData as unknown as AgentRunRow,
  };
}

export async function runProjectAgentFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const agentKeyValue = String(
    formData.get("agentKey") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const agentsPath = getAgentsPath(projectId);

  if (!isAgentKey(agentKeyValue)) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "El agente seleccionado no es válido."
      )}`
    );
  }

  if (agentKeyValue === "discovery") {
    redirect(`/projects/${projectId}/discovery`);
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const result = await executeProjectAgent({
    projectId,
    agentKey: agentKeyValue,
    userId: user.id,
    supabase,
  });

  if (!result.ok) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  revalidatePath(agentsPath);
  revalidatePath(`/projects/${projectId}`);

  redirect(
    `${agentsPath}?run=${encodeURIComponent(
      result.runId
    )}`
  );
}

export async function reviewAgentRunFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const runId = String(
    formData.get("runId") ?? ""
  ).trim();

  const decisionValue = String(
    formData.get("decision") ?? ""
  ).trim();

  const reviewerComment = String(
    formData.get("reviewerComment") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const agentsPath = getAgentsPath(projectId);

  if (!runId) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "La ejecución que deseas revisar es obligatoria."
      )}`
    );
  }

  if (!isAgentReviewDecision(decisionValue)) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "La decisión de revisión no es válida."
      )}`
    );
  }

  if (reviewerComment.length > 4000) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "El comentario de revisión no puede superar 4000 caracteres."
      )}`
    );
  }

  const context = await loadAuthenticatedRun({
    projectId,
    runId,
  });

  if (!context.ok) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        context.error
      )}`
    );
  }

  if (!context.isAdmin) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Solo un owner o admin de la organización puede revisar resultados de IA."
      )}`
    );
  }

  if (
    context.run.status !== "completed" ||
    context.run.output === null
  ) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Solo se pueden revisar ejecuciones completadas con una salida válida."
      )}`
    );
  }

  const {
    data: reviewData,
    error: reviewError,
  } = await context.supabase
    .from("agent_run_reviews")
    .select(
      "id, run_id, project_id, decision, reviewer_comment, reviewed_by, reviewed_at, application_status, application_summary, applied_by, applied_at"
    )
    .eq("run_id", runId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (reviewError) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        reviewError.message
      )}`
    );
  }

  if (!reviewData) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "No existe el registro de revisión. Aplica la migración 0007_agent_run_human_review.sql."
      )}`
    );
  }

  const review =
    reviewData as unknown as AgentRunReviewRow;

  if (review.application_status === "applied") {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "No puedes cambiar la decisión de una ejecución que ya fue aplicada al proyecto."
      )}`
    );
  }

  const {
    data: existingChangeSet,
    error: existingChangeSetError,
  } = await context.supabase
    .from("project_model_change_sets")
    .select("id")
    .eq("source_run_id", runId)
    .maybeSingle();

  if (existingChangeSetError) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        existingChangeSetError.message
      )}`
    );
  }

  if (
    existingChangeSet &&
    review.decision !== decisionValue
  ) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Esta ejecución ya tiene una propuesta granular. Mantén la decisión aprobada y gestiona cada cambio desde la propuesta."
      )}`
    );
  }

  const reviewedAt = new Date().toISOString();
  const applicationStatus: AgentApplicationStatus =
    decisionValue === "approved" &&
    context.run.agent_key === "project_model"
      ? "not_applied"
      : "not_applicable";

  const {
    data: updatedReview,
    error: updateError,
  } = await context.supabase
    .from("agent_run_reviews")
    .update({
      decision: decisionValue,
      reviewer_comment:
        reviewerComment || null,
      reviewed_by: context.user.id,
      reviewed_at: reviewedAt,
      application_status: applicationStatus,
      application_summary: {},
      applied_by: null,
      applied_at: null,
      updated_at: reviewedAt,
    })
    .eq("id", review.id)
    .eq("run_id", runId)
    .eq("project_id", projectId)
    .in("application_status", [
      "not_applied",
      "failed",
      "not_applicable",
    ])
    .select("id")
    .maybeSingle();

  if (updateError) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        updateError.message
      )}`
    );
  }

  if (!updatedReview) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "La revisión cambió mientras procesábamos la solicitud. Recarga la página antes de continuar."
      )}`
    );
  }

  await appendRunEvent({
    runId,
    eventType:
      decisionValue === "approved"
        ? "run_approved"
        : "run_rejected",
    payload: {
      reviewedBy: context.user.id,
      reviewedAt,
      hasComment: reviewerComment.length > 0,
    },
  });

  revalidateAgentReviewPaths(projectId);

  redirect(
    `${agentsPath}?reviewed=${decisionValue}&run=${encodeURIComponent(
      runId
    )}`
  );
}

type FullProjectModelRow = {
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

function mapFullProjectModel(row: FullProjectModelRow): ProjectModel {
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

type CreateChangeSetRpcResult = {
  ok: boolean;
  changeSetId?: string;
  error?: string;
};

function getCreateChangeSetRpcResult(
  value: unknown
): CreateChangeSetRpcResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      error: "La base de datos devolvió una respuesta de propuesta no válida.",
    };
  }

  const record = value as Record<string, unknown>;

  return {
    ok: record.ok === true,
    changeSetId:
      typeof record.changeSetId === "string"
        ? record.changeSetId
        : undefined,
    error:
      typeof record.error === "string"
        ? record.error
        : undefined,
  };
}

export async function createAgentChangeSetFormAction(
  formData: FormData
) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const runId = String(formData.get("runId") ?? "").trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const agentsPath = getAgentsPath(projectId);

  if (!runId) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "La ejecución de origen es obligatoria."
      )}`
    );
  }

  const context = await loadAuthenticatedRun({ projectId, runId });

  if (!context.ok) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(context.error)}`
    );
  }

  if (!context.isAdmin) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Solo un owner o admin puede preparar propuestas de cambios."
      )}`
    );
  }

  if (
    context.run.agent_key !== "project_model" ||
    context.run.status !== "completed" ||
    context.run.output === null
  ) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Solo una ejecución completada de Project Model Analyst puede convertirse en una propuesta."
      )}`
    );
  }

  const parsedOutput = projectModelAgentOutputSchema.safeParse(
    context.run.output
  );

  if (!parsedOutput.success) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "La salida guardada no cumple el esquema actual del Project Model Analyst."
      )}`
    );
  }

  const { data: modelData, error: modelError } = await context.supabase
    .from("project_models")
    .select(
      "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (modelError) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(modelError.message)}`
    );
  }

  if (!modelData) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "Genera primero el Project Model inicial antes de preparar cambios."
      )}`
    );
  }

  const currentModel = mapFullProjectModel(
    modelData as unknown as FullProjectModelRow
  );

  const proposedModel = normalizeAgentProjectModel({
    projectId,
    output: parsedOutput.data,
    generatedAt: currentModel.generatedAt,
  });

  const changes = createProjectModelChanges({
    current: currentModel,
    proposed: proposedModel,
  });
  const summary = summarizeProjectModelChanges(changes);

  const { data: rpcData, error: rpcError } = await context.supabase.rpc(
    "create_project_model_change_set",
    {
      target_project_id: projectId,
      target_run_id: runId,
      target_title: `Propuesta de Project Model Analyst · ${context.project.name}`,
      target_summary: summary,
      target_changes: changes,
    }
  );

  if (rpcError) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        `No se pudo preparar la propuesta: ${rpcError.message}`
      )}`
    );
  }

  const result = getCreateChangeSetRpcResult(rpcData);

  if (!result.ok || !result.changeSetId) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        result.error ?? "No se pudo preparar la propuesta de cambios."
      )}`
    );
  }

  revalidateAgentReviewPaths(projectId);
  revalidatePath(`/projects/${projectId}/analysis/change-sets`);

  redirect(
    `/projects/${projectId}/analysis/change-sets/${result.changeSetId}`
  );
}
