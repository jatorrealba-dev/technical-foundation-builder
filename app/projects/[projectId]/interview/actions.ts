"use server";

import { revalidatePath } from "next/cache";

import { initialInterviewQuestions } from "@/domain/interviews/interview";
import { createClient } from "@/lib/supabase/server";

type SaveInterviewAnswerInput = {
  projectId: string;
  questionId: string;
  answer: string;
};

export type SaveInterviewAnswerResult =
  | {
      ok: true;
      status: "in_progress" | "completed";
      completion: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function saveInterviewAnswerAction(
  input: SaveInterviewAnswerInput
): Promise<SaveInterviewAnswerResult> {
  const projectId = input.projectId.trim();
  const questionId = input.questionId.trim();
  const answer = input.answer.trim();

  if (!projectId) {
    return {
      ok: false,
      error: "El identificador del proyecto es obligatorio.",
    };
  }

  if (!questionId) {
    return {
      ok: false,
      error: "El identificador de la pregunta es obligatorio.",
    };
  }

  if (!answer) {
    return {
      ok: false,
      error: "La respuesta no puede estar vacía.",
    };
  }

  const question = initialInterviewQuestions.find(
    (item) => item.id === questionId
  );

  if (!question) {
    return {
      ok: false,
      error: "La pregunta seleccionada no es válida.",
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
      error: "Debes iniciar sesión para guardar respuestas.",
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

  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .upsert(
      {
        project_id: projectId,
        status: "in_progress",
        current_stage: question.stage,
        updated_at: now,
      },
      {
        onConflict: "project_id",
      }
    )
    .select("id")
    .single();

  if (sessionError) {
    return {
      ok: false,
      error: sessionError.message,
    };
  }

  const { error: answerError } = await supabase
    .from("interview_answers")
    .upsert(
      {
        interview_session_id: session.id,
        question_id: question.id,
        stage: question.stage,
        answer,
        answered_at: now,
      },
      {
        onConflict: "interview_session_id,question_id",
      }
    );

  if (answerError) {
    return {
      ok: false,
      error: answerError.message,
    };
  }

  const { data: storedAnswers, error: answersError } = await supabase
    .from("interview_answers")
    .select("question_id")
    .eq("interview_session_id", session.id);

  if (answersError) {
    return {
      ok: false,
      error: answersError.message,
    };
  }

  const answeredQuestionIds = new Set(
    (storedAnswers ?? []).map((item) => item.question_id)
  );

  const nextQuestion = initialInterviewQuestions.find(
    (item) => !answeredQuestionIds.has(item.id)
  );

  const completed =
    answeredQuestionIds.size >= initialInterviewQuestions.length;

  const status = completed ? "completed" : "in_progress";

  const { error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      status,
      current_stage: nextQuestion?.stage ?? question.stage,
      updated_at: now,
    })
    .eq("id", session.id);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message,
    };
  }

  const completion = Math.min(
    100,
    Math.round(
      (answeredQuestionIds.size / initialInterviewQuestions.length) * 100
    )
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/interview`);

  return {
    ok: true,
    status,
    completion,
  };
}
