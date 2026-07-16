"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdaptiveInterviewQuestion,
  InterviewAnswer,
  InterviewQuestionStatus,
  ProjectInterview,
} from "@/domain/interviews/interview";

import {
  importInterviewAgentRunFormAction,
  runDeterministicInterviewQuestionsFormAction,
  saveInterviewAnswerAction,
  setInterviewQuestionStatusAction,
} from "./actions";

type InterviewClientProps = {
  project: { id: string; name: string };
  initialInterview: ProjectInterview;
  approvedInterviewRuns: Array<{
    id: string;
    promptVersion: string;
    model: string;
    completedAt: string;
    imported: boolean;
  }>;
  canObsoleteQuestions: boolean;
  flash: {
    error: string | null;
    generated: string | null;
    added: number;
    skipped: number;
  };
};

const priorityLabel = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;

const statusLabel: Record<InterviewQuestionStatus, string> = {
  pending: "Pendiente",
  answered: "Respondida",
  skipped: "Omitida",
  deferred: "Pospuesta",
  obsolete: "Obsoleta",
};

const sourceLabel = {
  base: "Base",
  deterministic: "Regla",
  agent: "IA aprobada",
  manual: "Manual",
} as const;

function findAnswer(
  answers: InterviewAnswer[],
  questionId: string
): InterviewAnswer | undefined {
  return answers.find((answer) => answer.questionId === questionId);
}

function selectFirstActiveQuestion(
  questions: AdaptiveInterviewQuestion[]
): string {
  return (
    questions.find((question) => question.status === "pending")?.id ??
    questions.find((question) => question.status === "deferred")?.id ??
    questions.find((question) => question.status === "answered")?.id ??
    questions[0]?.id ??
    ""
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function completionFor(questions: AdaptiveInterviewQuestion[]): number {
  const active = questions.filter(
    (question) => question.status !== "obsolete"
  );

  if (active.length === 0) {
    return 0;
  }

  const resolved = active.filter((question) =>
    ["answered", "skipped"].includes(question.status)
  ).length;

  return Math.min(100, Math.round((resolved / active.length) * 100));
}

export function InterviewClient({
  project,
  initialInterview,
  approvedInterviewRuns,
  canObsoleteQuestions,
  flash,
}: InterviewClientProps) {
  const router = useRouter();
  const [interview, setInterview] = useState(initialInterview);
  const [activeQuestionId, setActiveQuestionId] = useState(
    selectFirstActiveQuestion(initialInterview.questions)
  );
  const [answerDraft, setAnswerDraft] = useState(
    findAnswer(initialInterview.answers, activeQuestionId)?.answer ?? ""
  );
  const [statusComment, setStatusComment] = useState("");
  const [error, setError] = useState(flash.error ?? "");
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const activeQuestion = interview.questions.find(
    (question) => question.id === activeQuestionId
  );
  const completion = completionFor(interview.questions);

  const counts = useMemo(() => {
    return interview.questions.reduce(
      (result, question) => {
        result[question.status] += 1;
        return result;
      },
      {
        pending: 0,
        answered: 0,
        skipped: 0,
        deferred: 0,
        obsolete: 0,
      } as Record<InterviewQuestionStatus, number>
    );
  }, [interview.questions]);

  function getAnswer(questionId: string) {
    return findAnswer(interview.answers, questionId);
  }

  function chooseQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setAnswerDraft(getAnswer(questionId)?.answer ?? "");
    setStatusComment("");
    setError("");
  }

  function nextActiveQuestion(
    questions: AdaptiveInterviewQuestion[],
    preferred?: string | null
  ): string {
    if (preferred && questions.some((question) => question.id === preferred)) {
      return preferred;
    }

    return selectFirstActiveQuestion(questions);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!activeQuestion) {
      setError("No hay una pregunta activa.");
      return;
    }

    const answer = answerDraft.trim();

    if (!answer) {
      setError("La respuesta no puede estar vacía.");
      return;
    }

    setSaving(true);

    try {
      const result = await saveInterviewAnswerAction({
        projectId: project.id,
        questionId: activeQuestion.id,
        answer,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const now = new Date().toISOString();
      const nextAnswers = [
        ...interview.answers.filter(
          (item) => item.questionId !== activeQuestion.id
        ),
        {
          questionId: activeQuestion.id,
          answer,
          answeredAt: now,
        },
      ];
      const nextQuestions = interview.questions.map((question) =>
        question.id === activeQuestion.id
          ? {
              ...question,
              status: "answered" as const,
              reviewerComment: null,
              updatedAt: now,
            }
          : question
      );
      const nextId = nextActiveQuestion(
        nextQuestions,
        result.nextQuestionId
      );

      setInterview((current) => ({
        ...current,
        status:
          result.status === "completed" ? "completed" : "in_progress",
        answers: nextAnswers,
        questions: nextQuestions,
        updatedAt: now,
      }));
      setActiveQuestionId(nextId);
      setAnswerDraft(findAnswer(nextAnswers, nextId)?.answer ?? "");
      router.refresh();
    } catch {
      setError("No fue posible guardar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    status: Exclude<InterviewQuestionStatus, "answered">
  ) {
    if (!activeQuestion) {
      return;
    }

    setChangingStatus(true);
    setError("");

    try {
      const result = await setInterviewQuestionStatusAction({
        projectId: project.id,
        questionId: activeQuestion.id,
        status,
        comment: statusComment,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const now = new Date().toISOString();
      const nextQuestions = interview.questions.map((question) =>
        question.id === activeQuestion.id
          ? {
              ...question,
              status,
              reviewerComment: statusComment.trim() || null,
              updatedAt: now,
            }
          : question
      );
      const nextId = nextActiveQuestion(
        nextQuestions,
        result.nextQuestionId
      );

      setInterview((current) => ({
        ...current,
        status:
          result.status === "completed"
            ? "completed"
            : result.status === "not_started"
              ? "not_started"
              : "in_progress",
        questions: nextQuestions,
        updatedAt: now,
      }));
      setActiveQuestionId(nextId);
      setAnswerDraft(getAnswer(nextId)?.answer ?? "");
      setStatusComment("");
      router.refresh();
    } catch {
      setError("No fue posible actualizar el estado de la pregunta.");
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>← Volver al proyecto</Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/agents`}>
              Abrir agentes IA
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Entrevista adaptativa v8</Badge>
            <Badge variant="outline">{interview.status}</Badge>
            <Badge variant="outline">
              {counts.answered} respondidas
            </Badge>
            {counts.deferred > 0 ? (
              <Badge variant="outline">{counts.deferred} pospuestas</Badge>
            ) : null}
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            {project.name}
          </h1>
          <p className="mt-3 max-w-4xl text-muted-foreground">
            La entrevista conserva las preguntas base, agrega seguimientos
            deterministas o aprobados por IA, evita duplicados y explica el
            impacto de cada pregunta antes de responderla.
          </p>
        </header>

        {flash.generated ? (
          <div className="mb-6 rounded-md border bg-muted/30 px-4 py-3 text-sm">
            Lote {flash.generated === "agent" ? "de IA" : "determinista"}
            procesado: {flash.added} preguntas nuevas y {flash.skipped}
            duplicadas omitidas.
          </div>
        ) : null}

        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Cobertura de entrevista</span>
            <span className="text-muted-foreground">{completion}%</span>
          </div>
          <Progress value={completion} />
          <p className="text-sm text-muted-foreground">
            La entrevista se considera completa cuando no quedan preguntas
            obligatorias pendientes o pospuestas. Omitir una pregunta queda
            registrado y no equivale a responderla.
          </p>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Generación determinista</CardTitle>
              <CardDescription>
                Analiza las respuestas actuales mediante reglas locales. No
                consume créditos de OpenAI y deduplica preguntas existentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={runDeterministicInterviewQuestionsFormAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <Button type="submit" variant="outline" className="w-full">
                  Detectar preguntas de seguimiento
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview Strategist aprobado</CardTitle>
              <CardDescription>
                Solo se pueden importar ejecuciones completadas y aprobadas.
                Cada ejecución se importa una sola vez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvedInterviewRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No existen ejecuciones aprobadas disponibles. Ejecuta
                  Interview Strategist desde Agentes IA y aprueba el resultado.
                </p>
              ) : (
                approvedInterviewRuns.map((run) => (
                  <form
                    key={run.id}
                    action={importInterviewAgentRunFormAction}
                    className="rounded-lg border p-3"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="runId" value={run.id} />
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{run.promptVersion}</Badge>
                      <Badge variant="secondary">{run.model}</Badge>
                      {run.imported ? <Badge>Importada</Badge> : null}
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Completada {formatDate(run.completedAt)}
                    </p>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={run.imported}
                    >
                      {run.imported ? "Ya importada" : "Importar preguntas"}
                    </Button>
                  </form>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {interview.latestBatch ? (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Último diagnóstico adaptativo</CardTitle>
                <Badge variant="outline">
                  {interview.latestBatch.source === "agent"
                    ? "IA aprobada"
                    : "Determinista"}
                </Badge>
                <Badge variant="secondary">
                  {interview.latestBatch.recommendation}
                </Badge>
              </div>
              <CardDescription>
                {interview.latestBatch.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">
                  Información faltante
                </p>
                {interview.latestBatch.missingInformation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No se reportaron vacíos adicionales.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {interview.latestBatch.missingInformation.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Contradicciones</p>
                {interview.latestBatch.contradictions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No se reportaron contradicciones.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {interview.latestBatch.contradictions.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Preguntas gobernadas</CardTitle>
              <CardDescription>
                Las preguntas están priorizadas y conservan origen, estado y
                trazabilidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[780px] space-y-3 overflow-y-auto">
              {interview.questions.map((question) => {
                const active = question.id === activeQuestionId;
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => chooseQuestion(question.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    } ${question.status === "obsolete" ? "opacity-60" : ""}`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{question.stage}</Badge>
                      <Badge
                        variant={
                          question.status === "answered"
                            ? "default"
                            : question.status === "obsolete"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {statusLabel[question.status]}
                      </Badge>
                      <Badge variant="secondary">
                        {priorityLabel[question.priority]}
                      </Badge>
                      <Badge variant="outline">
                        {sourceLabel[question.source]}
                      </Badge>
                      {question.required ? <Badge>Obligatoria</Badge> : null}
                    </div>
                    <p className="text-sm font-medium">{question.question}</p>
                    {question.reviewerComment ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Nota: {question.reviewerComment}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>
                    {activeQuestion?.question ?? "Pregunta no disponible"}
                  </CardTitle>
                  {activeQuestion ? (
                    <Badge variant="outline">
                      {statusLabel[activeQuestion.status]}
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {activeQuestion?.helperText ??
                    "Selecciona una pregunta para continuar."}
                </CardDescription>
              </CardHeader>

              {activeQuestion ? (
                <CardContent className="space-y-6">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 text-sm font-medium">
                      ¿Por qué preguntamos esto?
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {activeQuestion.reason ||
                        "Esta pregunta aporta evidencia al Project Model."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeQuestion.riskArea ? (
                        <Badge variant="outline">
                          Riesgo: {activeQuestion.riskArea}
                        </Badge>
                      ) : null}
                      {activeQuestion.affectsArtifacts.map((artifact) => (
                        <Badge key={artifact} variant="secondary">
                          {artifact}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="answer">Respuesta</Label>
                      <Textarea
                        id="answer"
                        className="min-h-44"
                        placeholder="Escribe una respuesta clara, verificable y completa."
                        value={answerDraft}
                        onChange={(event) => setAnswerDraft(event.target.value)}
                        disabled={
                          saving ||
                          changingStatus ||
                          activeQuestion.status === "obsolete"
                        }
                      />
                    </div>

                    {error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="submit"
                        disabled={
                          saving ||
                          changingStatus ||
                          activeQuestion.status === "obsolete"
                        }
                      >
                        {saving
                          ? "Guardando..."
                          : getAnswer(activeQuestion.id)
                            ? "Actualizar respuesta"
                            : "Guardar respuesta"}
                      </Button>
                    </div>
                  </form>

                  {activeQuestion.status !== "answered" ? (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor="status-comment">
                            Motivo del cambio de estado
                          </Label>
                          <Textarea
                            id="status-comment"
                            className="min-h-20"
                            placeholder="Explica por qué se omite, pospone o vuelve a abrir."
                            value={statusComment}
                            onChange={(event) =>
                              setStatusComment(event.target.value)
                            }
                            disabled={changingStatus}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeQuestion.status !== "pending" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={changingStatus}
                              onClick={() => changeStatus("pending")}
                            >
                              Reabrir
                            </Button>
                          ) : null}
                          {activeQuestion.status !== "deferred" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={changingStatus}
                              onClick={() => changeStatus("deferred")}
                            >
                              Posponer
                            </Button>
                          ) : null}
                          {activeQuestion.status !== "skipped" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={changingStatus}
                              onClick={() => changeStatus("skipped")}
                            >
                              Omitir
                            </Button>
                          ) : null}
                          {canObsoleteQuestions &&
                          activeQuestion.status !== "obsolete" ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={changingStatus}
                              onClick={() => changeStatus("obsolete")}
                            >
                              Marcar obsoleta
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Respuestas consolidadas</CardTitle>
                <CardDescription>
                  El Project Model y los agentes reciben este contexto junto
                  con el catálogo y los estados de las preguntas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {interview.answers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay respuestas guardadas.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {interview.questions
                      .filter((question) => Boolean(getAnswer(question.id)))
                      .map((question) => (
                        <div key={question.id} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{question.stage}</Badge>
                            <Badge variant="secondary">
                              {sourceLabel[question.source]}
                            </Badge>
                            <p className="text-sm font-medium">
                              {question.question}
                            </p>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {getAnswer(question.id)?.answer}
                          </p>
                          <Separator />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
