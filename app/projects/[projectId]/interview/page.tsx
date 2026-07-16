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
  AdaptiveInterviewQuestion,
  InterviewAnswer,
  InterviewBatch,
  InterviewQuestionPriority,
  InterviewQuestionSource,
  InterviewQuestionStatus,
  InterviewStage,
  ProjectInterview,
} from "@/domain/interviews/interview";
import { interviewStages } from "@/domain/interviews/interview";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import { createClient } from "@/lib/supabase/server";

import { InterviewClient } from "./interview-client";

type ProjectInterviewPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    error?: string;
    generated?: string;
    added?: string;
    skipped?: string;
  }>;
};

type ProjectRow = {
  id: string;
  organization_id: string;
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

type InterviewQuestionRow = {
  id: string;
  question_id: string;
  stage: InterviewStage;
  question: string;
  helper_text: string;
  reason: string;
  priority: InterviewQuestionPriority;
  source: InterviewQuestionSource;
  source_run_id: string | null;
  status: InterviewQuestionStatus;
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
  source: "deterministic" | "agent";
  source_run_id: string | null;
  summary: string;
  recommendation: InterviewBatch["recommendation"];
  confidence: number | null;
  missing_information: string[];
  contradictions: string[];
  question_count: number;
  created_at: string;
};

type AgentRunRow = {
  id: string;
  prompt_version: string;
  model: string;
  completed_at: string | null;
  created_at: string;
};

type AgentReviewRow = {
  run_id: string;
  decision: string;
};

type MembershipRow = {
  role: string;
};

function normalizeStatus(
  value: string | undefined
): ProjectInterview["status"] {
  if (value === "in_progress" || value === "completed") {
    return value;
  }

  return "not_started";
}

function normalizeStage(value: string | undefined): InterviewStage {
  if (
    value &&
    interviewStages.includes(value as InterviewStage)
  ) {
    return value as InterviewStage;
  }

  return "idea";
}

export default async function ProjectInterviewPage({
  params,
  searchParams,
}: ProjectInterviewPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
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
      .select("id, organization_id, name")
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
              <CardTitle>Proyecto no encontrado</CardTitle>
              <CardDescription>
                No existe un proyecto accesible con este identificador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Volver al dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const project = projectData as unknown as ProjectRow;

  const { data: ensureData, error: ensureError } =
    await supabase.rpc("ensure_adaptive_interview", {
      target_project_id: projectId,
    });

  if (ensureError) {
    throw new Error(ensureError.message);
  }

  const ensureResult = (ensureData ?? {}) as {
    ok?: boolean;
    error?: string;
  };

  if (!ensureResult.ok) {
    throw new Error(
      ensureResult.error ?? "No se pudo preparar la entrevista."
    );
  }

  const [
    sessionResult,
    questionsResult,
    batchResult,
    runsResult,
    reviewsResult,
    membershipResult,
  ] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("id, status, current_stage, created_at, updated_at")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("interview_questions")
      .select(
        "id, question_id, stage, question, helper_text, reason, priority, source, source_run_id, status, sort_order, fingerprint, affects_artifacts, risk_area, is_required, reviewer_comment, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("interview_question_batches")
      .select(
        "id, source, source_run_id, summary, recommendation, confidence, missing_information, contradictions, question_count, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("agent_runs")
      .select("id, prompt_version, model, completed_at, created_at")
      .eq("project_id", projectId)
      .eq("agent_key", "interview")
      .eq("status", "completed")
      .eq("prompt_version", "interview.v2")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_run_reviews")
      .select("run_id, decision")
      .eq("project_id", projectId)
      .eq("decision", "approved"),
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (sessionResult.error) {
    throw new Error(sessionResult.error.message);
  }
  if (questionsResult.error) {
    throw new Error(questionsResult.error.message);
  }
  if (batchResult.error) {
    throw new Error(batchResult.error.message);
  }
  if (runsResult.error) {
    throw new Error(runsResult.error.message);
  }
  if (reviewsResult.error) {
    throw new Error(reviewsResult.error.message);
  }
  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  const session = sessionResult.data as unknown as InterviewSessionRow;

  const { data: answerRows, error: answersError } = await supabase
    .from("interview_answers")
    .select("question_id, answer, answered_at")
    .eq("interview_session_id", session.id)
    .order("answered_at", { ascending: true });

  if (answersError) {
    throw new Error(answersError.message);
  }

  const answers: InterviewAnswer[] = (
    (answerRows ?? []) as unknown as InterviewAnswerRow[]
  ).map((answer) => ({
    questionId: answer.question_id,
    answer: answer.answer,
    answeredAt: answer.answered_at,
  }));

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

  const latestBatch = batchResult.data
    ? (() => {
        const batch =
          batchResult.data as unknown as InterviewBatchRow;
        return {
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
        } satisfies InterviewBatch;
      })()
    : null;

  const approvedRunIds = new Set(
    (
      (reviewsResult.data ?? []) as unknown as AgentReviewRow[]
    ).map((review) => review.run_id)
  );

  const importedRunIds = new Set(
    questions
      .filter((question) => question.source === "agent")
      .map((question) => question.sourceRunId)
      .filter((value): value is string => Boolean(value))
  );

  const approvedInterviewRuns = (
    (runsResult.data ?? []) as unknown as AgentRunRow[]
  )
    .filter((run) => approvedRunIds.has(run.id))
    .map((run) => ({
      id: run.id,
      promptVersion: run.prompt_version,
      model: run.model,
      completedAt: run.completed_at ?? run.created_at,
      imported: importedRunIds.has(run.id),
    }));

  const interview: ProjectInterview = {
    projectId,
    status: normalizeStatus(session.status),
    currentStage: normalizeStage(session.current_stage),
    answers,
    questions,
    latestBatch,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };

  const role = (
    membershipResult.data as unknown as MembershipRow | null
  )?.role;

  return (
    <InterviewClient
      project={{ id: project.id, name: project.name }}
      initialInterview={interview}
      approvedInterviewRuns={approvedInterviewRuns}
      canObsoleteQuestions={canManageAgentReviews(role)}
      flash={{
        error: query.error ?? null,
        generated: query.generated ?? null,
        added: Number(query.added ?? 0),
        skipped: Number(query.skipped ?? 0),
      }}
    />
  );
}
