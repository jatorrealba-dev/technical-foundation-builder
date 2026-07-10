import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  InterviewAnswer,
  InterviewStage,
  ProjectInterview,
} from "@/domain/interviews/interview";
import { createClient } from "@/lib/supabase/server";

import { InterviewClient } from "./interview-client";

type ProjectInterviewPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectSummary = {
  id: string;
  name: string;
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

const interviewStages: InterviewStage[] = [
  "idea",
  "product",
  "users",
  "domain",
  "security",
  "architecture",
  "delivery",
];

function normalizeInterviewStatus(
  value: string | undefined
): ProjectInterview["status"] {
  if (
    value === "in_progress" ||
    value === "completed"
  ) {
    return value;
  }

  return "not_started";
}

function normalizeInterviewStage(
  value: string | undefined
): InterviewStage {
  if (
    value &&
    interviewStages.includes(
      value as InterviewStage
    )
  ) {
    return value as InterviewStage;
  }

  return "idea";
}

export default async function ProjectInterviewPage({
  params,
}: ProjectInterviewPageProps) {
  const { projectId } = await params;
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
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!projectData) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>
                Proyecto no encontrado
              </CardTitle>

              <CardDescription>
                No existe un proyecto accesible con este
                identificador.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Button asChild>
                <Link href="/dashboard">
                  Volver al dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const project =
    projectData as unknown as ProjectSummary;

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase
    .from("interview_sessions")
    .select(
      "id, status, current_stage, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const session =
    sessionData as unknown as InterviewSessionRow | null;

  let answers: InterviewAnswer[] = [];

  if (session) {
    const {
      data: answerRows,
      error: answersError,
    } = await supabase
      .from("interview_answers")
      .select(
        "question_id, answer, answered_at"
      )
      .eq(
        "interview_session_id",
        session.id
      )
      .order("answered_at", {
        ascending: true,
      });

    if (answersError) {
      throw new Error(answersError.message);
    }

    answers = (
      (answerRows ?? []) as unknown as InterviewAnswerRow[]
    ).map((answerRow) => ({
      questionId: answerRow.question_id,
      answer: answerRow.answer,
      answeredAt: answerRow.answered_at,
    }));
  }

  const now = new Date().toISOString();

  const interview: ProjectInterview = {
    projectId,
    status: normalizeInterviewStatus(
      session?.status
    ),
    currentStage: normalizeInterviewStage(
      session?.current_stage
    ),
    answers,
    createdAt: session?.created_at ?? now,
    updatedAt: session?.updated_at ?? now,
  };

  return (
    <InterviewClient
      project={project}
      initialInterview={interview}
    />
  );
}
