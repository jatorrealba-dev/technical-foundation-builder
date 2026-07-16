"use server";

import { revalidatePath } from "next/cache";

import {
  interviewStages,
  type AdaptiveInterviewQuestion,
  type InterviewBatch,
  type InterviewStage,
  type ProjectInterview,
} from "@/domain/interviews/interview";
import { createClient } from "@/lib/supabase/server";
import { generateProjectModelFromInterview } from "@/services/project-model/generate-project-model";

type GenerateProjectModelInput = {
  projectId: string;
};

export type GenerateProjectModelResult =
  | {
      ok: true;
      generatedAt: string;
    }
  | {
      ok: false;
      error: string;
    };

type InterviewSessionRow = {
  id: string;
  status: string;
  current_stage: string;
  created_at: string;
  updated_at: string;
};

type InterviewAnswerRow = {
  question_id: string;
  answer: string;
  answered_at: string;
};

type InterviewQuestionRow = {
  id: string;
  question_id: string;
  stage: AdaptiveInterviewQuestion["stage"];
  question: string;
  helper_text: string;
  reason: string;
  priority: AdaptiveInterviewQuestion["priority"];
  source: AdaptiveInterviewQuestion["source"];
  source_run_id: string | null;
  status: AdaptiveInterviewQuestion["status"];
  sort_order: number;
  fingerprint: string;
  affects_artifacts: AdaptiveInterviewQuestion["affectsArtifacts"];
  risk_area: string | null;
  is_required: boolean;
  reviewer_comment: string | null;
  created_at: string;
  updated_at: string;
};

type InterviewBatchRow = {
  id: string;
  source: InterviewBatch["source"];
  source_run_id: string | null;
  summary: string;
  recommendation: InterviewBatch["recommendation"];
  confidence: number | null;
  missing_information: string[];
  contradictions: string[];
  question_count: number;
  created_at: string;
};

function isInterviewStage(value: string): value is InterviewStage {
  return interviewStages.includes(value as InterviewStage);
}

export async function generateProjectModelAction(
  input: GenerateProjectModelInput
): Promise<GenerateProjectModelResult> {
  const projectId = input.projectId.trim();

  if (!projectId) {
    return {
      ok: false,
      error: "El identificador del proyecto es obligatorio.",
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
      error: "Debes iniciar sesión para generar el análisis.",
    };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return {
      ok: false,
      error: projectError.message,
    };
  }

  if (!project) {
    return {
      ok: false,
      error: "El proyecto no existe o no tienes acceso.",
    };
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("interview_sessions")
    .select("id, status, current_stage, created_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (sessionError) {
    return {
      ok: false,
      error: sessionError.message,
    };
  }

  if (!sessionData) {
    return {
      ok: false,
      error:
        "Debes responder al menos una pregunta de la entrevista antes de generar el análisis.",
    };
  }

  const session = sessionData as InterviewSessionRow;

  const { data: answersData, error: answersError } = await supabase
    .from("interview_answers")
    .select("question_id, answer, answered_at")
    .eq("interview_session_id", session.id)
    .order("answered_at", {
      ascending: true,
    });

  if (answersError) {
    return {
      ok: false,
      error: answersError.message,
    };
  }

  const storedAnswers = (answersData ?? []) as InterviewAnswerRow[];

  if (storedAnswers.length === 0) {
    return {
      ok: false,
      error:
        "Debes responder al menos una pregunta de la entrevista antes de generar el análisis.",
    };
  }

  const [questionsResult, batchResult] = await Promise.all([
    supabase
      .from("interview_questions")
      .select(
        "id, question_id, stage, question, helper_text, reason, priority, source, source_run_id, status, sort_order, fingerprint, affects_artifacts, risk_area, is_required, reviewer_comment, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("interview_question_batches")
      .select(
        "id, source, source_run_id, summary, recommendation, confidence, missing_information, contradictions, question_count, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (questionsResult.error) {
    return { ok: false, error: questionsResult.error.message };
  }

  if (batchResult.error) {
    return { ok: false, error: batchResult.error.message };
  }

  const questions: AdaptiveInterviewQuestion[] = (
    (questionsResult.data ?? []) as unknown as InterviewQuestionRow[]
  ).map((question) => ({
    databaseId: question.id,
    id: question.question_id,
    stage: question.stage,
    question: question.question,
    helperText: question.helper_text,
    reason: question.reason,
    priority: question.priority,
    sortOrder: question.sort_order,
    affectsArtifacts: question.affects_artifacts ?? [],
    riskArea: question.risk_area,
    required: question.is_required,
    source: question.source,
    sourceRunId: question.source_run_id,
    status: question.status,
    fingerprint: question.fingerprint,
    reviewerComment: question.reviewer_comment,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
  }));

  const nextQuestion = questions.find(
    (question) =>
      question.status === "pending" || question.status === "deferred"
  );

  const interviewStatus: ProjectInterview["status"] =
    session.status === "completed" ? "completed" : "in_progress";

  const currentStage: InterviewStage =
    nextQuestion?.stage ??
    (isInterviewStage(session.current_stage)
      ? session.current_stage
      : "delivery");

  const batch = batchResult.data
    ? (batchResult.data as unknown as InterviewBatchRow)
    : null;

  const interview: ProjectInterview = {
    projectId,
    status: interviewStatus,
    currentStage,
    answers: storedAnswers.map((answer) => ({
      questionId: answer.question_id,
      answer: answer.answer,
      answeredAt: answer.answered_at,
    })),
    questions,
    latestBatch: batch
      ? {
          id: batch.id,
          source: batch.source,
          sourceRunId: batch.source_run_id,
          summary: batch.summary,
          recommendation: batch.recommendation,
          confidence: batch.confidence,
          missingInformation: batch.missing_information ?? [],
          contradictions: batch.contradictions ?? [],
          questionCount: batch.question_count,
          createdAt: batch.created_at,
        }
      : null,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };

  const model = generateProjectModelFromInterview(interview);

  const { error: modelError } = await supabase
    .from("project_models")
    .upsert(
      {
        project_id: projectId,
        status: model.status,
        requirements: model.requirements,
        assumptions: model.assumptions,
        domain_entities: model.domainEntities,
        risks: model.risks,
        open_questions: model.openQuestions,
        generated_at: model.generatedAt,
        updated_at: model.updatedAt,
      },
      {
        onConflict: "project_id",
      }
    );

  if (modelError) {
    return {
      ok: false,
      error: modelError.message,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/analysis`);
  revalidatePath(
    `/projects/${projectId}/analysis/history`
  );

  return {
    ok: true,
    generatedAt: model.generatedAt,
  };
}
