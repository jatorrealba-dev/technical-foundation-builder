"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { FoundationProject } from "@/domain/projects/project";
import { InterviewAnswer, ProjectInterview } from "@/domain/interviews/interview";
import { getLocalProjectById } from "@/lib/local-project-store";
import {
  getInitialInterviewQuestions,
  getInterviewCompletionPercentage,
  getProjectInterview,
  saveInterviewAnswer,
} from "@/lib/local-interview-store";
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

export default function ProjectInterviewPage() {
  const params = useParams<{ projectId: string }>();

  const [project, setProject] = useState<FoundationProject | null>(null);
  const [interview, setInterview] = useState<ProjectInterview | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string>("");
  const [answerDraft, setAnswerDraft] = useState("");
  const [error, setError] = useState("");

  const questions = useMemo(() => getInitialInterviewQuestions(), []);

  useEffect(() => {
    const loadedProject = getLocalProjectById(params.projectId);
    const loadedInterview = getProjectInterview(params.projectId);

    setProject(loadedProject);
    setInterview(loadedInterview);

    const firstUnansweredQuestion =
      questions.find(
        (question) =>
          !loadedInterview.answers.some(
            (answer) => answer.questionId === question.id
          )
      ) ?? questions[0];

    if (firstUnansweredQuestion) {
      setActiveQuestionId(firstUnansweredQuestion.id);

      const existingAnswer =
        loadedInterview.answers.find(
          (answer) => answer.questionId === firstUnansweredQuestion.id
        )?.answer ?? "";

      setAnswerDraft(existingAnswer);
    }
  }, [params.projectId, questions]);

  const activeQuestion = questions.find(
    (question) => question.id === activeQuestionId
  );

  const completion = interview
    ? getInterviewCompletionPercentage(interview.projectId)
    : 0;

  function getAnswer(questionId: string): InterviewAnswer | undefined {
    return interview?.answers.find((answer) => answer.questionId === questionId);
  }

  function selectQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setError("");

    const existingAnswer = getAnswer(questionId)?.answer ?? "";
    setAnswerDraft(existingAnswer);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!activeQuestion) {
      setError("No hay una pregunta activa.");
      return;
    }

    if (!answerDraft.trim()) {
      setError("La respuesta no puede estar vacía.");
      return;
    }

    const updatedInterview = saveInterviewAnswer({
      projectId: params.projectId,
      questionId: activeQuestion.id,
      answer: answerDraft,
    });

    setInterview(updatedInterview);

    const nextQuestion = questions.find(
      (question) =>
        !updatedInterview.answers.some(
          (answer) => answer.questionId === question.id
        )
    );

    if (nextQuestion) {
      setActiveQuestionId(nextQuestion.id);
      setAnswerDraft("");
    }
  }

  if (!project || !interview) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Proyecto no encontrado</CardTitle>
              <CardDescription>
                No existe un proyecto local con este identificador.
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

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>← Volver al proyecto</Link>
          </Button>
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Entrevista inicial</Badge>
            <Badge variant="outline">{interview.status}</Badge>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            {project.name}
          </h1>

          <p className="mt-3 max-w-3xl text-muted-foreground">
            Responde estas preguntas base. Luego este contenido será usado para
            extraer requisitos, entidades, supuestos, riesgos y documentos.
          </p>
        </header>

        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progreso de entrevista</span>
            <span className="text-muted-foreground">{completion}%</span>
          </div>
          <Progress value={completion} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Preguntas</CardTitle>
              <CardDescription>
                Las preguntas están organizadas por áreas críticas del proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((question) => {
                const answered = Boolean(getAnswer(question.id));
                const active = question.id === activeQuestionId;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => selectQuestion(question.id)}
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
                      <Badge variant={answered ? "default" : "outline"}>
                        {answered ? "Respondida" : "Pendiente"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {question.question}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{activeQuestion?.question}</CardTitle>
                <CardDescription>{activeQuestion?.helperText}</CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="answer">Respuesta</Label>
                    <Textarea
                      id="answer"
                      className="min-h-44"
                      placeholder="Escribe una respuesta clara y completa."
                      value={answerDraft}
                      onChange={(event) => setAnswerDraft(event.target.value)}
                    />
                  </div>

                  {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="submit">Guardar respuesta</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de respuestas</CardTitle>
                <CardDescription>
                  Este resumen será la base del Project Model estructurado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {interview.answers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay respuestas guardadas.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {questions
                      .filter((question) => getAnswer(question.id))
                      .map((question) => (
                        <div key={question.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{question.stage}</Badge>
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
