"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  AdaptiveInterviewQuestion,
  InterviewAnswer,
  InterviewQuestionStatus,
} from "@/domain/interviews/interview";
import { createClient } from "@/lib/supabase/server";
import { interviewAgentOutputSchema } from "@/schemas/agents/agent-outputs";
import { generateDeterministicInterviewQuestions } from "@/services/interviews/generate-deterministic-interview-questions";
import { normalizeAgentInterviewQuestions } from "@/services/interviews/normalize-agent-interview-output";

export type InterviewActionResult =
  | {
      ok: true;
      status?: string;
      completion?: number;
      nextQuestionId?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

type RpcResult = {
  ok?: boolean;
  error?: string;
  status?: string;
  sessionStatus?: string;
  completion?: number;
  nextQuestionId?: string | null;
  batchId?: string;
  insertedCount?: number;
  skippedCount?: number;
};

type InterviewQuestionRow = {
  question_id: string;
  question: string;
  fingerprint: string;
  status: AdaptiveInterviewQuestion["status"];
};

type InterviewAnswerRow = {
  question_id: string;
  answer: string;
  answered_at: string;
};

type AgentRunRow = {
  id: string;
  agent_key: string;
  status: string;
  prompt_version: string;
  output: unknown;
};

function interviewPath(projectId: string): string {
  return `/projects/${projectId}/interview`;
}

function redirectWithError(
  projectId: string,
  message: string
): never {
  redirect(
    `${interviewPath(projectId)}?error=${encodeURIComponent(message)}`
  );
}

function revalidateInterview(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(interviewPath(projectId));
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

export async function saveInterviewAnswerAction(input: {
  projectId: string;
  questionId: string;
  answer: string;
}): Promise<InterviewActionResult> {
  const projectId = input.projectId.trim();
  const questionId = input.questionId.trim();
  const answer = input.answer.trim();

  if (!projectId || !questionId) {
    return {
      ok: false,
      error: "El proyecto y la pregunta son obligatorios.",
    };
  }

  if (!answer) {
    return {
      ok: false,
      error: "La respuesta no puede estar vacía.",
    };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "save_adaptive_interview_answer",
    {
      target_project_id: projectId,
      target_question_id: questionId,
      target_answer: answer,
    }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = (data ?? {}) as RpcResult;

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "No se pudo guardar la respuesta.",
    };
  }

  revalidateInterview(projectId);

  return {
    ok: true,
    status: result.status,
    completion: result.completion,
    nextQuestionId: result.nextQuestionId ?? null,
  };
}

export async function setInterviewQuestionStatusAction(input: {
  projectId: string;
  questionId: string;
  status: Exclude<InterviewQuestionStatus, "answered">;
  comment?: string;
}): Promise<InterviewActionResult> {
  const projectId = input.projectId.trim();
  const questionId = input.questionId.trim();

  if (!projectId || !questionId) {
    return {
      ok: false,
      error: "El proyecto y la pregunta son obligatorios.",
    };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "set_interview_question_status",
    {
      target_project_id: projectId,
      target_question_id: questionId,
      target_status: input.status,
      target_comment: input.comment?.trim() || null,
    }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = (data ?? {}) as RpcResult;

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "No se pudo actualizar la pregunta.",
    };
  }

  revalidateInterview(projectId);

  return {
    ok: true,
    status: result.sessionStatus,
    nextQuestionId: result.nextQuestionId ?? null,
  };
}

export async function runDeterministicInterviewQuestionsFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const { supabase } = await requireUser();

  const { data: ensureData, error: ensureError } =
    await supabase.rpc("ensure_adaptive_interview", {
      target_project_id: projectId,
    });

  if (ensureError) {
    redirectWithError(projectId, ensureError.message);
  }

  const ensureResult = (ensureData ?? {}) as RpcResult;

  if (!ensureResult.ok) {
    redirectWithError(
      projectId,
      ensureResult.error ?? "No se pudo preparar la entrevista."
    );
  }

  const { data: sessionData, error: sessionError } =
    await supabase
      .from("interview_sessions")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

  if (sessionError || !sessionData) {
    redirectWithError(
      projectId,
      sessionError?.message ?? "No se encontró la sesión."
    );
  }

  const [answersResult, questionsResult] = await Promise.all([
    supabase
      .from("interview_answers")
      .select("question_id, answer, answered_at")
      .eq("interview_session_id", sessionData.id),
    supabase
      .from("interview_questions")
      .select("question_id, question, fingerprint, status")
      .eq("project_id", projectId),
  ]);

  if (answersResult.error) {
    redirectWithError(projectId, answersResult.error.message);
  }

  if (questionsResult.error) {
    redirectWithError(projectId, questionsResult.error.message);
  }

  const answers: InterviewAnswer[] = (
    (answersResult.data ?? []) as unknown as InterviewAnswerRow[]
  ).map((answer) => ({
    questionId: answer.question_id,
    answer: answer.answer,
    answeredAt: answer.answered_at,
  }));

  const existingQuestions = (
    (questionsResult.data ?? []) as unknown as InterviewQuestionRow[]
  ).map((question) => ({
    question: question.question,
    fingerprint: question.fingerprint,
    status: question.status,
  }));

  const proposed = generateDeterministicInterviewQuestions({
    answers,
    existingQuestions,
  });

  const { data, error } = await supabase.rpc(
    "record_interview_question_batch",
    {
      target_project_id: projectId,
      target_source: "deterministic",
      target_source_run_id: null,
      target_summary:
        proposed.length > 0
          ? `Se detectaron ${proposed.length} preguntas de seguimiento basadas en las respuestas actuales.`
          : "No se detectaron preguntas deterministas nuevas sin duplicar el contexto existente.",
      target_recommendation:
        proposed.length > 0
          ? "continue_interview"
          : "ready_for_model",
      target_confidence: 1,
      target_missing_information: proposed.map(
        (question) => question.reason
      ),
      target_contradictions: [],
      target_questions: proposed,
    }
  );

  if (error) {
    redirectWithError(projectId, error.message);
  }

  const result = (data ?? {}) as RpcResult;

  if (!result.ok) {
    redirectWithError(
      projectId,
      result.error ?? "No se pudo guardar el lote adaptativo."
    );
  }

  revalidateInterview(projectId);

  redirect(
    `${interviewPath(projectId)}?generated=deterministic&added=${result.insertedCount ?? 0}&skipped=${result.skippedCount ?? 0}`
  );
}

export async function importInterviewAgentRunFormAction(
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
      "Selecciona una ejecución aprobada de Interview Strategist."
    );
  }

  const { supabase } = await requireUser();
  const [runResult, reviewResult] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("id, agent_key, status, prompt_version, output")
      .eq("id", runId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("agent_run_reviews")
      .select("decision")
      .eq("run_id", runId)
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (runResult.error) {
    redirectWithError(projectId, runResult.error.message);
  }

  if (reviewResult.error) {
    redirectWithError(projectId, reviewResult.error.message);
  }

  const run = runResult.data
    ? (runResult.data as unknown as AgentRunRow)
    : null;

  if (
    !run ||
    run.agent_key !== "interview" ||
    run.status !== "completed" ||
    run.prompt_version !== "interview.v2"
  ) {
    redirectWithError(
      projectId,
      "La ejecución seleccionada no es un Interview Strategist completado."
    );
  }

  if (reviewResult.data?.decision !== "approved") {
    redirectWithError(
      projectId,
      "La ejecución debe estar aprobada antes de importar preguntas."
    );
  }

  const parsed = interviewAgentOutputSchema.safeParse(run.output);

  if (!parsed.success) {
    redirectWithError(
      projectId,
      "La salida del agente no cumple el esquema de Interview Strategist v2."
    );
  }

  const proposed = normalizeAgentInterviewQuestions(parsed.data);

  const { data, error } = await supabase.rpc(
    "record_interview_question_batch",
    {
      target_project_id: projectId,
      target_source: "agent",
      target_source_run_id: runId,
      target_summary: parsed.data.summary,
      target_recommendation: parsed.data.recommendation,
      target_confidence: parsed.data.confidence,
      target_missing_information: parsed.data.missingInformation,
      target_contradictions: parsed.data.contradictions,
      target_questions: proposed,
    }
  );

  if (error) {
    redirectWithError(projectId, error.message);
  }

  const result = (data ?? {}) as RpcResult;

  if (!result.ok) {
    redirectWithError(
      projectId,
      result.error ?? "No se pudieron importar las preguntas."
    );
  }

  revalidateInterview(projectId);

  redirect(
    `${interviewPath(projectId)}?generated=agent&added=${result.insertedCount ?? 0}&skipped=${result.skippedCount ?? 0}`
  );
}
