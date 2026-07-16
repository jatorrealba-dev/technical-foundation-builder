"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isConsistencyFindingStatus,
  summarizeConsistencyFindings,
} from "@/domain/consistency/consistency";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import { consistencyAgentOutputSchema } from "@/schemas/agents/agent-outputs";
import {
  generateDeterministicConsistencyFindings,
  type ConsistencyArtifactStateInput,
} from "@/services/consistency/generate-deterministic-findings";
import { normalizeAgentConsistencyOutput } from "@/services/consistency/normalize-agent-consistency-output";

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
  status: ConsistencyArtifactStateInput["status"];
  based_on_model_version: number | null;
  reason: string | null;
};

type ProjectModelVersionRow = {
  id: string;
  version_number: number;
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

type ConsistencyRpcResult = {
  ok?: boolean;
  scanId?: string;
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

function getConsistencyPath(projectId: string): string {
  return `/projects/${projectId}/consistency`;
}

function redirectWithError(
  projectId: string,
  message: string
): never {
  redirect(
    `${getConsistencyPath(projectId)}?error=${encodeURIComponent(message)}`
  );
}

function revalidateConsistencyPaths(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(getConsistencyPath(projectId));
  revalidatePath(`/projects/${projectId}/agents`);
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

export async function runDeterministicConsistencyScanFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

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

  const [{ data: artifactRows, error: artifactsError }, {
    data: artifactStateRows,
    error: artifactStatesError,
  }, latestVersion] = await Promise.all([
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
    loadLatestProjectModelVersion(projectId),
  ]);

  if (artifactsError) {
    redirectWithError(projectId, artifactsError.message);
  }

  if (artifactStatesError) {
    redirectWithError(projectId, artifactStatesError.message);
  }

  const projectModel = mapProjectModel(
    modelData as unknown as ProjectModelRow
  );

  const findings = generateDeterministicConsistencyFindings({
    projectModel,
    artifacts: ((artifactRows ?? []) as unknown as ArtifactRow[]).map(
      (artifact) => ({
        type: artifact.type,
        content: artifact.content,
      })
    ),
    artifactStates: (
      (artifactStateRows ?? []) as unknown as ArtifactStateRow[]
    ).map((state) => ({
      artifactType: state.artifact_type,
      status: state.status,
      basedOnModelVersion: state.based_on_model_version,
      reason: state.reason,
    })),
  });

  const summary = summarizeConsistencyFindings(findings);

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "record_consistency_scan",
    {
      target_project_id: projectId,
      target_source: "deterministic",
      target_source_run_id: null,
      target_model_version_id: latestVersion?.id ?? null,
      target_model_version_number:
        latestVersion?.version_number ?? null,
      target_summary: {
        ...summary,
        engineVersion: "deterministic.v1",
        modelUpdatedAt: projectModel.updatedAt,
      },
      target_findings: findings,
    }
  );

  if (rpcError) {
    redirectWithError(projectId, rpcError.message);
  }

  const result = (rpcData ?? {}) as ConsistencyRpcResult;

  if (!result.ok || !result.scanId) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudo guardar el análisis de consistencia."
    );
  }

  revalidateConsistencyPaths(projectId);

  redirect(
    `${getConsistencyPath(projectId)}?scanned=1&scan=${encodeURIComponent(result.scanId)}`
  );
}

export async function importConsistencyAgentRunFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();
  const runId = String(formData.get("runId") ?? "").trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!runId) {
    redirectWithError(
      projectId,
      "La ejecución de Consistency Reviewer es obligatoria."
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

  const [{ data: runData, error: runError }, {
    data: reviewData,
    error: reviewError,
  }, latestVersion] = await Promise.all([
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

  if (runError) {
    redirectWithError(projectId, runError.message);
  }

  if (reviewError) {
    redirectWithError(projectId, reviewError.message);
  }

  if (!runData) {
    redirectWithError(
      projectId,
      "La ejecución no existe o no pertenece al proyecto."
    );
  }

  const run = runData as unknown as AgentRunRow;
  const review = reviewData
    ? (reviewData as unknown as AgentReviewRow)
    : null;

  if (
    run.agent_key !== "consistency" ||
    run.status !== "completed" ||
    run.output === null
  ) {
    redirectWithError(
      projectId,
      "La ejecución seleccionada no es un Consistency Reviewer completado."
    );
  }

  if (review?.decision !== "approved") {
    redirectWithError(
      projectId,
      "Aprueba primero la ejecución de Consistency Reviewer."
    );
  }

  const parsedOutput = consistencyAgentOutputSchema.safeParse(
    run.output
  );

  if (!parsedOutput.success) {
    redirectWithError(
      projectId,
      "La salida del agente no cumple el esquema de consistencia esperado."
    );
  }

  const findings = normalizeAgentConsistencyOutput(
    parsedOutput.data
  );
  const summary = summarizeConsistencyFindings(findings);

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "record_consistency_scan",
    {
      target_project_id: projectId,
      target_source: "agent",
      target_source_run_id: runId,
      target_model_version_id: latestVersion?.id ?? null,
      target_model_version_number:
        latestVersion?.version_number ?? null,
      target_summary: {
        ...summary,
        agentSummary: parsedOutput.data.summary,
        passedChecks: parsedOutput.data.passedChecks,
        requiresHumanReview:
          parsedOutput.data.requiresHumanReview,
        confidence: parsedOutput.data.confidence,
      },
      target_findings: findings,
    }
  );

  if (rpcError) {
    redirectWithError(projectId, rpcError.message);
  }

  const result = (rpcData ?? {}) as ConsistencyRpcResult;

  if (!result.ok || !result.scanId) {
    redirectWithError(
      projectId,
      result.error ??
        "No se pudieron importar los hallazgos del agente."
    );
  }

  revalidateConsistencyPaths(projectId);

  redirect(
    `${getConsistencyPath(projectId)}?imported=1&scan=${encodeURIComponent(result.scanId)}`
  );
}

export async function reviewConsistencyFindingFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();
  const findingId = String(
    formData.get("findingId") ?? ""
  ).trim();
  const statusValue = String(
    formData.get("status") ?? ""
  ).trim();
  const comment = String(
    formData.get("comment") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!findingId) {
    redirectWithError(projectId, "El hallazgo es obligatorio.");
  }

  if (!isConsistencyFindingStatus(statusValue)) {
    redirectWithError(
      projectId,
      "El estado seleccionado no es válido."
    );
  }

  if (comment.length > 4000) {
    redirectWithError(
      projectId,
      "El comentario no puede superar 4000 caracteres."
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

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "review_consistency_finding",
    {
      target_finding_id: findingId,
      target_status: statusValue,
      target_comment: comment || null,
    }
  );

  if (rpcError) {
    redirectWithError(projectId, rpcError.message);
  }

  const result = (rpcData ?? {}) as {
    ok?: boolean;
    error?: string;
  };

  if (!result.ok) {
    redirectWithError(
      projectId,
      result.error ?? "No se pudo actualizar el hallazgo."
    );
  }

  revalidateConsistencyPaths(projectId);

  redirect(
    `${getConsistencyPath(projectId)}?updated=1#finding-${encodeURIComponent(findingId)}`
  );
}
