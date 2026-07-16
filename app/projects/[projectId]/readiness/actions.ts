"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { ProjectModel } from "@/domain/project-model/project-model";
import {
  isReadinessActionStatus,
  isReadinessBlockerStatus,
} from "@/domain/readiness/readiness";
import { createClient } from "@/lib/supabase/server";
import { readinessAgentOutputSchema } from "@/schemas/agents/agent-outputs";
import {
  generateDeterministicReadinessAssessment,
  type ReadinessArtifactStateInput,
  type ReadinessConsistencyFindingInput,
} from "@/services/readiness/generate-deterministic-readiness";
import { normalizeAgentReadinessOutput } from "@/services/readiness/normalize-agent-readiness-output";

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
  type: ArtifactType;
  content: string;
};

type ArtifactStateRow = {
  artifact_type: ArtifactType;
  status: ReadinessArtifactStateInput["status"];
  based_on_model_version: number | null;
  reason: string | null;
};

type ConsistencyFindingRow = {
  severity: ReadinessConsistencyFindingInput["severity"];
  category: ReadinessConsistencyFindingInput["category"];
  status: ReadinessConsistencyFindingInput["status"];
  title: string;
};

type ProjectModelVersionRow = {
  id: string;
  version_number: number;
};

type InterviewSessionRow = {
  id: string;
  status: string;
};

type AgentRunRow = {
  id: string;
  agent_key: string;
  status: string;
  output: unknown;
};

type AgentReviewRow = {
  decision: string;
};

type ReadinessRpcResult = {
  ok?: boolean;
  assessmentId?: string;
  existing?: boolean;
  error?: string;
};

function mapProjectModel(row: ProjectModelRow): ProjectModel {
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

function getReadinessPath(projectId: string): string {
  return `/projects/${projectId}/readiness`;
}

function redirectWithError(
  projectId: string,
  message: string
): never {
  redirect(
    `${getReadinessPath(projectId)}?error=${encodeURIComponent(message)}`
  );
}

function revalidateReadinessPaths(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(getReadinessPath(projectId));
  revalidatePath(`/projects/${projectId}/agents`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function loadLatestProjectModelVersion(
  projectId: string
): Promise<ProjectModelVersionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_model_versions")
    .select("id, version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? (data as unknown as ProjectModelVersionRow)
    : null;
}

async function persistAssessment(input: {
  projectId: string;
  sourceRunId: string | null;
  modelVersion: ProjectModelVersionRow | null;
  assessment: ReturnType<
    typeof generateDeterministicReadinessAssessment
  >;
}): Promise<ReadinessRpcResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "record_readiness_assessment",
    {
      target_project_id: input.projectId,
      target_source: input.assessment.source,
      target_source_run_id: input.sourceRunId,
      target_model_version_id:
        input.modelVersion?.id ?? null,
      target_model_version_number:
        input.modelVersion?.version_number ?? null,
      target_summary: input.assessment.summary,
      target_overall_score:
        input.assessment.overallScore,
      target_level: input.assessment.level,
      target_confidence: input.assessment.confidence,
      target_evidence_snapshot:
        input.assessment.evidenceSnapshot,
      target_dimensions: input.assessment.dimensions,
      target_blockers: input.assessment.blockers,
      target_actions: input.assessment.nextActions,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? {}) as ReadinessRpcResult;
}

export async function runDeterministicReadinessAssessmentFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const { supabase } = await requireUser();

  const { data: projectData, error: projectError } =
    await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

  if (projectError) {
    redirectWithError(projectId, projectError.message);
  }

  if (!projectData) {
    redirectWithError(
      projectId,
      "El proyecto no existe o no tienes acceso."
    );
  }

  const { data: modelData, error: modelError } =
    await supabase
      .from("project_models")
      .select(
        "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
      )
      .eq("project_id", projectId)
      .maybeSingle();

  if (modelError) {
    redirectWithError(projectId, modelError.message);
  }

  if (!modelData) {
    redirectWithError(
      projectId,
      "Genera primero el Project Model."
    );
  }

  const [
    artifactsResult,
    artifactStatesResult,
    consistencyResult,
    interviewSessionResult,
    latestVersion,
  ] = await Promise.all([
    supabase
      .from("artifacts")
      .select("type, content")
      .eq("project_id", projectId),
    supabase
      .from("project_artifact_states")
      .select(
        "artifact_type, status, based_on_model_version, reason"
      )
      .eq("project_id", projectId),
    supabase
      .from("consistency_findings")
      .select("severity, category, status, title")
      .eq("project_id", projectId),
    supabase
      .from("interview_sessions")
      .select("id, status")
      .eq("project_id", projectId)
      .maybeSingle(),
    loadLatestProjectModelVersion(projectId),
  ]);

  if (artifactsResult.error) {
    redirectWithError(
      projectId,
      artifactsResult.error.message
    );
  }

  if (artifactStatesResult.error) {
    redirectWithError(
      projectId,
      artifactStatesResult.error.message
    );
  }

  if (consistencyResult.error) {
    redirectWithError(
      projectId,
      consistencyResult.error.message
    );
  }

  if (interviewSessionResult.error) {
    redirectWithError(
      projectId,
      interviewSessionResult.error.message
    );
  }

  const interviewSession = interviewSessionResult.data
    ? (interviewSessionResult.data as unknown as InterviewSessionRow)
    : null;

  let answeredCount = 0;
  let totalQuestions = 0;

  if (interviewSession) {
    const [answersCountResult, questionsResult] = await Promise.all([
      supabase
        .from("interview_answers")
        .select("id", { count: "exact", head: true })
        .eq("interview_session_id", interviewSession.id),
      supabase
        .from("interview_questions")
        .select("status")
        .eq("project_id", projectId)
        .neq("status", "obsolete"),
    ]);

    if (answersCountResult.error) {
      redirectWithError(projectId, answersCountResult.error.message);
    }

    if (questionsResult.error) {
      redirectWithError(projectId, questionsResult.error.message);
    }

    answeredCount = answersCountResult.count ?? 0;
    totalQuestions = (questionsResult.data ?? []).length;
  }

  const projectModel = mapProjectModel(
    modelData as unknown as ProjectModelRow
  );

  const assessment =
    generateDeterministicReadinessAssessment({
      projectModel,
      modelVersionNumber:
        latestVersion?.version_number ?? null,
      artifacts: (
        (artifactsResult.data ?? []) as unknown as ArtifactRow[]
      ).map((artifact) => ({
        type: artifact.type,
        content: artifact.content,
      })),
      artifactStates: (
        (artifactStatesResult.data ?? []) as unknown as ArtifactStateRow[]
      ).map((state) => ({
        artifactType: state.artifact_type,
        status: state.status,
        basedOnModelVersion:
          state.based_on_model_version,
        reason: state.reason,
      })),
      consistencyFindings: (
        (consistencyResult.data ?? []) as unknown as ConsistencyFindingRow[]
      ),
      interview: {
        status: interviewSession?.status ?? null,
        answeredCount,
        totalQuestions,
      },
    });

  let result: ReadinessRpcResult;

  try {
    result = await persistAssessment({
      projectId,
      sourceRunId: null,
      modelVersion: latestVersion,
      assessment,
    });
  } catch (error) {
    redirectWithError(
      projectId,
      error instanceof Error
        ? error.message
        : "No se pudo guardar la evaluación."
    );
  }

  if (!result.ok || !result.assessmentId) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudo guardar la evaluación de readiness."
    );
  }

  revalidateReadinessPaths(projectId);

  redirect(
    `${getReadinessPath(projectId)}?assessed=1&assessment=${encodeURIComponent(result.assessmentId)}`
  );
}

export async function importReadinessAgentRunFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();
  const runId = String(
    formData.get("runId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!runId) {
    redirectWithError(
      projectId,
      "La ejecución de Readiness Assessor es obligatoria."
    );
  }

  const { supabase } = await requireUser();

  const [runResult, reviewResult, latestVersion] =
    await Promise.all([
      supabase
        .from("agent_runs")
        .select("id, agent_key, status, output")
        .eq("id", runId)
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("agent_run_reviews")
        .select("decision")
        .eq("run_id", runId)
        .eq("project_id", projectId)
        .maybeSingle(),
      loadLatestProjectModelVersion(projectId),
    ]);

  if (runResult.error) {
    redirectWithError(projectId, runResult.error.message);
  }

  if (reviewResult.error) {
    redirectWithError(projectId, reviewResult.error.message);
  }

  if (!runResult.data) {
    redirectWithError(
      projectId,
      "La ejecución no existe o no pertenece al proyecto."
    );
  }

  const run = runResult.data as unknown as AgentRunRow;
  const review = reviewResult.data
    ? (reviewResult.data as unknown as AgentReviewRow)
    : null;

  if (
    run.agent_key !== "readiness" ||
    run.status !== "completed" ||
    run.output === null
  ) {
    redirectWithError(
      projectId,
      "Solo se puede importar una ejecución completada de Readiness Assessor."
    );
  }

  if (review?.decision !== "approved") {
    redirectWithError(
      projectId,
      "Aprueba primero el resultado de Readiness Assessor."
    );
  }

  const parsed = readinessAgentOutputSchema.safeParse(
    run.output
  );

  if (!parsed.success) {
    redirectWithError(
      projectId,
      "La salida del agente no cumple el esquema de readiness vigente. Ejecuta nuevamente Readiness Assessor con la versión actual del prompt."
    );
  }

  const assessment = normalizeAgentReadinessOutput(
    parsed.data,
    runId
  );

  let result: ReadinessRpcResult;

  try {
    result = await persistAssessment({
      projectId,
      sourceRunId: runId,
      modelVersion: latestVersion,
      assessment,
    });
  } catch (error) {
    redirectWithError(
      projectId,
      error instanceof Error
        ? error.message
        : "No se pudo importar la evaluación."
    );
  }

  if (!result.ok || !result.assessmentId) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudo importar la evaluación del agente."
    );
  }

  revalidateReadinessPaths(projectId);

  redirect(
    `${getReadinessPath(projectId)}?imported=1&assessment=${encodeURIComponent(result.assessmentId)}`
  );
}

export async function reviewReadinessBlockerFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();
  const blockerId = String(
    formData.get("blockerId") ?? ""
  ).trim();
  const status = String(
    formData.get("status") ?? ""
  ).trim();
  const comment = String(
    formData.get("comment") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!blockerId || !isReadinessBlockerStatus(status)) {
    redirectWithError(
      projectId,
      "El bloqueador o su estado no es válido."
    );
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "review_readiness_blocker",
    {
      target_blocker_id: blockerId,
      target_status: status,
      target_comment: comment || null,
    }
  );

  if (error) {
    redirectWithError(projectId, error.message);
  }

  const result = (data ?? {}) as ReadinessRpcResult;

  if (!result.ok) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudo actualizar el bloqueador."
    );
  }

  revalidateReadinessPaths(projectId);
  redirect(`${getReadinessPath(projectId)}?updated=1`);
}

export async function reviewReadinessActionFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();
  const actionId = String(
    formData.get("actionId") ?? ""
  ).trim();
  const status = String(
    formData.get("status") ?? ""
  ).trim();
  const comment = String(
    formData.get("comment") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!actionId || !isReadinessActionStatus(status)) {
    redirectWithError(
      projectId,
      "La acción o su estado no es válido."
    );
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "review_readiness_action",
    {
      target_action_id: actionId,
      target_status: status,
      target_comment: comment || null,
    }
  );

  if (error) {
    redirectWithError(projectId, error.message);
  }

  const result = (data ?? {}) as ReadinessRpcResult;

  if (!result.ok) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudo actualizar la acción."
    );
  }

  revalidateReadinessPaths(projectId);
  redirect(`${getReadinessPath(projectId)}?updated=1`);
}
