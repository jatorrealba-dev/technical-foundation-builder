"use client";

import Link from "next/link";
import {
  type FormEvent,
  useState,
} from "react";

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
import {
  initialInterviewQuestions,
  type InterviewAnswer,
  type ProjectInterview,
} from "@/domain/interviews/interview";

import { saveInterviewAnswerAction } from "./actions";

type ProjectSummary = {
  id: string;
  name: string;
};

type InterviewClientProps = {
  project: ProjectSummary;
  initialInterview: ProjectInterview;
};

function findAnswer(
  answers: InterviewAnswer[],
  questionId: string
): InterviewAnswer | undefined {
  return answers.find(
    (answer) => answer.questionId === questionId
  );
}

function getInitialQuestionId(
  interview: ProjectInterview
): string {
  const firstUnansweredQuestion =
    initialInterviewQuestions.find(
      (question) =>
        !interview.answers.some(
          (answer) =>
            answer.questionId === question.id
        )
    );

  return (
    firstUnansweredQuestion?.id ??
    initialInterviewQuestions[0]?.id ??
    ""
  );
}

export function InterviewClient({
  project,
  initialInterview,
}: InterviewClientProps) {
  const initialQuestionId =
    getInitialQuestionId(initialInterview);

  const [interview, setInterview] =
    useState<ProjectInterview>(initialInterview);

  const [activeQuestionId, setActiveQuestionId] =
    useState(initialQuestionId);

  const [answerDraft, setAnswerDraft] = useState(
    findAnswer(
      initialInterview.answers,
      initialQuestionId
    )?.answer ?? ""
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeQuestion =
    initialInterviewQuestions.find(
      (question) =>
        question.id === activeQuestionId
    );

  const completion = Math.min(
    100,
    Math.round(
      (interview.answers.length /
        initialInterviewQuestions.length) *
        100
    )
  );

  function getAnswer(
    questionId: string
  ): InterviewAnswer | undefined {
    return findAnswer(
      interview.answers,
      questionId
    );
  }

  function selectQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setError("");

    setAnswerDraft(
      getAnswer(questionId)?.answer ?? ""
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (!activeQuestion) {
      setError("No hay una pregunta activa.");
      return;
    }

    const normalizedAnswer = answerDraft.trim();

    if (!normalizedAnswer) {
      setError(
        "La respuesta no puede estar vacía."
      );
      return;
    }

    setSaving(true);

    try {
      const result =
        await saveInterviewAnswerAction({
          projectId: project.id,
          questionId: activeQuestion.id,
          answer: normalizedAnswer,
        });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const now = new Date().toISOString();

      const nextAnswers: InterviewAnswer[] = [
        ...interview.answers.filter(
          (answer) =>
            answer.questionId !==
            activeQuestion.id
        ),
        {
          questionId: activeQuestion.id,
          answer: normalizedAnswer,
          answeredAt: now,
        },
      ];

      const nextQuestion =
        initialInterviewQuestions.find(
          (question) =>
            !nextAnswers.some(
              (answer) =>
                answer.questionId ===
                question.id
            )
        );

      setInterview((currentInterview) => ({
        ...currentInterview,
        status: result.status,
        currentStage:
          nextQuestion?.stage ??
          activeQuestion.stage,
        answers: nextAnswers,
        updatedAt: now,
      }));

      if (nextQuestion) {
        setActiveQuestionId(nextQuestion.id);

        setAnswerDraft(
          findAnswer(
            nextAnswers,
            nextQuestion.id
          )?.answer ?? ""
        );
      } else {
        setAnswerDraft(normalizedAnswer);
      }
    } catch {
      setError(
        "No fue posible guardar la respuesta. Intenta nuevamente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>
              ← Volver al proyecto
            </Link>
          </Button>
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Entrevista inicial
            </Badge>

            <Badge variant="outline">
              {interview.status}
            </Badge>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            {project.name}
          </h1>

          <p className="mt-3 max-w-3xl text-muted-foreground">
            Responde estas preguntas base. Las respuestas
            se guardan en Supabase y serán utilizadas para
            generar requisitos, entidades, supuestos,
            riesgos y documentos.
          </p>
        </header>

        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Progreso de entrevista
            </span>

            <span className="text-muted-foreground">
              {completion}%
            </span>
          </div>

          <Progress value={completion} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Preguntas</CardTitle>

              <CardDescription>
                Las preguntas están organizadas por áreas
                críticas del proyecto.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {initialInterviewQuestions.map(
                (question) => {
                  const answered = Boolean(
                    getAnswer(question.id)
                  );

                  const active =
                    question.id ===
                    activeQuestionId;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() =>
                        selectQuestion(
                          question.id
                        )
                      }
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {question.stage}
                        </span>

                        <Badge
                          variant={
                            answered
                              ? "default"
                              : "outline"
                          }
                        >
                          {answered
                            ? "Respondida"
                            : "Pendiente"}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {question.question}
                      </p>
                    </button>
                  );
                }
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeQuestion?.question ??
                    "Pregunta no disponible"}
                </CardTitle>

                <CardDescription>
                  {activeQuestion?.helperText ??
                    "Selecciona una pregunta para continuar."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="answer">
                      Respuesta
                    </Label>

                    <Textarea
                      id="answer"
                      className="min-h-44"
                      placeholder="Escribe una respuesta clara y completa."
                      value={answerDraft}
                      onChange={(event) =>
                        setAnswerDraft(
                          event.target.value
                        )
                      }
                      disabled={
                        saving ||
                        !activeQuestion
                      }
                    />
                  </div>

                  {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        saving ||
                        !activeQuestion
                      }
                    >
                      {saving
                        ? "Guardando..."
                        : getAnswer(
                              activeQuestionId
                            )
                          ? "Actualizar respuesta"
                          : "Guardar respuesta"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Resumen de respuestas
                </CardTitle>

                <CardDescription>
                  Este resumen será la base del Project Model
                  estructurado.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {interview.answers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay respuestas guardadas.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {initialInterviewQuestions
                      .filter((question) =>
                        Boolean(
                          getAnswer(question.id)
                        )
                      )
                      .map((question) => (
                        <div
                          key={question.id}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {question.stage}
                            </Badge>

                            <p className="text-sm font-medium">
                              {question.question}
                            </p>
                          </div>

                          <p className="text-sm leading-6 text-muted-foreground">
                            {
                              getAnswer(
                                question.id
                              )?.answer
                            }
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
