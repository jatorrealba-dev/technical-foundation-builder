"use server";

import { revalidatePath } from "next/cache";

import {
  initialInterviewQuestions,
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

function isInterviewStage(value: string): value is InterviewStage {
  return (
    value === "idea" ||
    value === "product" ||
    value === "users" ||
    value === "domain" ||
    value === "security" ||
    value === "architecture" ||
    value === "delivery"
  );
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

  const answeredQuestionIds = new Set(
    storedAnswers.map((answer) => answer.question_id)
  );

  const nextQuestion = initialInterviewQuestions.find(
    (question) => !answeredQuestionIds.has(question.id)
  );

  const interviewStatus: ProjectInterview["status"] =
    answeredQuestionIds.size >= initialInterviewQuestions.length
      ? "completed"
      : "in_progress";

  const currentStage: InterviewStage =
    nextQuestion?.stage ??
    (isInterviewStage(session.current_stage)
      ? session.current_stage
      : "delivery");

  const interview: ProjectInterview = {
    projectId,
    status: interviewStatus,
    currentStage,
    answers: storedAnswers.map((answer) => ({
      questionId: answer.question_id,
      answer: answer.answer,
      answeredAt: answer.answered_at,
    })),
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

  return {
    ok: true,
    generatedAt: model.generatedAt,
  };
}
