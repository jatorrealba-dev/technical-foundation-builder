import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  artifactCatalog,
  artifactTypes,
} from "@/domain/artifacts/artifact-catalog";
import type { ArtifactType } from "@/domain/artifacts/artifact";
import { initialInterviewQuestions } from "@/domain/interviews/interview";
import { createClient } from "@/lib/supabase/server";

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  industry: string;
  product_type: string;
  technical_level: string;
  main_goal: string;
  status: string;
  created_at: string;
};

type InterviewSessionRow = {
  id: string;
  status: string;
  current_stage: string;
};

type ProjectModelSummaryRow = {
  status: string;
  generated_at: string;
};

type ArtifactSummaryRow = {
  type: ArtifactType;
  filename: string;
  updated_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInterviewStatusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "En progreso";

    case "completed":
      return "Completada";

    default:
      return "No iniciada";
  }
}

function getInterviewButtonLabel(input: {
  status: string;
  answeredCount: number;
}): string {
  if (input.status === "completed") {
    return "Revisar entrevista";
  }

  if (input.answeredCount > 0) {
    return "Continuar entrevista";
  }

  return "Iniciar entrevista";
}

function getDocumentsStatusLabel(input: {
  generatedCount: number;
  totalCount: number;
}): string {
  if (input.generatedCount === 0) {
    return "Pendiente";
  }

  if (input.generatedCount === input.totalCount) {
    return "Paquete completo";
  }

  return `${input.generatedCount} de ${input.totalCount} generados`;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, industry, product_type, technical_level, main_goal, status, created_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project) {
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

  const projectRow = project as unknown as ProjectRow;

  const { data: sessionData, error: sessionError } = await supabase
    .from("interview_sessions")
    .select("id, status, current_stage")
    .eq("project_id", projectRow.id)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const interviewSession =
    sessionData as unknown as InterviewSessionRow | null;

  let answeredCount = 0;

  if (interviewSession) {
    const { count, error: answersError } = await supabase
      .from("interview_answers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("interview_session_id", interviewSession.id);

    if (answersError) {
      throw new Error(answersError.message);
    }

    answeredCount = count ?? 0;
  }

  const { data: projectModelData, error: projectModelError } =
    await supabase
      .from("project_models")
      .select("status, generated_at")
      .eq("project_id", projectRow.id)
      .maybeSingle();

  if (projectModelError) {
    throw new Error(projectModelError.message);
  }

  const projectModel =
    projectModelData as unknown as ProjectModelSummaryRow | null;

  const { data: artifactsData, error: artifactsError } =
    await supabase
      .from("artifacts")
      .select("type, filename, updated_at")
      .eq("project_id", projectRow.id)
      .in("type", [...artifactTypes])
      .order("updated_at", {
        ascending: false,
      });

  if (artifactsError) {
    throw new Error(artifactsError.message);
  }

  const artifacts = (
    (artifactsData ?? []) as unknown as ArtifactSummaryRow[]
  );

  const generatedArtifactTypes = new Set(
    artifacts.map((artifact) => artifact.type)
  );

  const generatedDocumentsCount =
    artifactCatalog.filter((artifact) =>
      generatedArtifactTypes.has(artifact.type)
    ).length;

  const totalDocumentsCount = artifactCatalog.length;

  const documentsCompletion =
    totalDocumentsCount === 0
      ? 0
      : Math.round(
          (generatedDocumentsCount / totalDocumentsCount) * 100
        );

  const latestArtifact = artifacts[0] ?? null;

  const totalQuestions = initialInterviewQuestions.length;

  const interviewCompletion =
    totalQuestions === 0
      ? 0
      : Math.min(
          100,
          Math.round((answeredCount / totalQuestions) * 100)
        );

  const interviewStatus =
    interviewSession?.status ?? "not_started";

  const interviewStatusLabel =
    getInterviewStatusLabel(interviewStatus);

  const interviewButtonLabel = getInterviewButtonLabel({
    status: interviewStatus,
    answeredCount,
  });

  const analysisButtonLabel = projectModel
    ? "Revisar análisis"
    : "Generar análisis";

  const documentsButtonLabel = !projectModel
    ? "Documentos: requiere análisis"
    : generatedDocumentsCount > 0
      ? "Revisar documentos"
      : "Generar documentos";

  const documentsStatusLabel = getDocumentsStatusLabel({
    generatedCount: generatedDocumentsCount,
    totalCount: totalDocumentsCount,
  });

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              ← Volver al dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {projectRow.status}
              </Badge>

              <Badge variant="outline">
                {projectRow.product_type}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              {projectRow.name}
            </h1>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              {projectRow.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {projectModel ? (
              <Button variant="outline" asChild>
                <Link href={`/projects/${projectRow.id}/documents`}>
                  {documentsButtonLabel}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                {documentsButtonLabel}
              </Button>
            )}

            <Button variant="outline" asChild>
              <Link href={`/projects/${projectRow.id}/agents`}>
                Agentes IA
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href={`/projects/${projectRow.id}/analysis`}>
                {analysisButtonLabel}
              </Link>
            </Button>

            <Button asChild>
              <Link href={`/projects/${projectRow.id}/interview`}>
                {interviewButtonLabel}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información base</CardTitle>

                <CardDescription>
                  Datos iniciales guardados en Supabase.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">
                    Industria
                  </p>

                  <p className="text-muted-foreground">
                    {projectRow.industry || "No definida"}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">
                    Nivel técnico
                  </p>

                  <p className="text-muted-foreground">
                    {projectRow.technical_level}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">
                    Objetivo principal
                  </p>

                  <p className="text-muted-foreground">
                    {projectRow.main_goal || "No definido"}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">
                    Creado
                  </p>

                  <p className="text-muted-foreground">
                    {formatDate(projectRow.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      Progreso de entrevista
                    </CardTitle>

                    <CardDescription className="mt-2">
                      Avance real calculado desde las respuestas
                      guardadas en Supabase.
                    </CardDescription>
                  </div>

                  <Badge
                    variant={
                      interviewStatus === "completed"
                        ? "default"
                        : "outline"
                    }
                  >
                    {interviewStatusLabel}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Progress value={interviewCompletion} />

                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>
                    {interviewCompletion}% completado
                  </p>

                  <p>
                    {answeredCount} de {totalQuestions} preguntas
                    respondidas.
                  </p>
                </div>

                {interviewSession ? (
                  <p className="text-sm text-muted-foreground">
                    Etapa actual:{" "}
                    <span className="font-medium text-foreground">
                      {interviewSession.current_stage}
                    </span>
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      Estado del análisis
                    </CardTitle>

                    <CardDescription className="mt-2">
                      Project Model generado desde las respuestas
                      persistidas de la entrevista.
                    </CardDescription>
                  </div>

                  <Badge
                    variant={
                      projectModel ? "default" : "outline"
                    }
                  >
                    {projectModel ? "Generado" : "Pendiente"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                {projectModel ? (
                  <p className="text-sm text-muted-foreground">
                    Última generación:{" "}
                    {formatDate(projectModel.generated_at)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no se ha generado el análisis inicial.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      Estado de documentos
                    </CardTitle>

                    <CardDescription className="mt-2">
                      Progreso real del paquete técnico persistido
                      en Supabase.
                    </CardDescription>
                  </div>

                  <Badge
                    variant={
                      generatedDocumentsCount > 0
                        ? "default"
                        : "outline"
                    }
                  >
                    {documentsStatusLabel}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Progress value={documentsCompletion} />

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {generatedDocumentsCount} de{" "}
                    {totalDocumentsCount} documentos generados.
                  </p>

                  <p>
                    {documentsCompletion}% del paquete completo.
                  </p>

                  {latestArtifact ? (
                    <p>
                      Última actualización:{" "}
                      {formatDate(latestArtifact.updated_at)}
                    </p>
                  ) : (
                    <p>
                      Todavía no se ha generado ningún documento.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Paquete técnico
              </CardTitle>

              <CardDescription>
                Estado real de los documentos generados desde el
                Project Model persistido en Supabase.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3">
                {artifactCatalog.map((artifact) => {
                  const generated =
                    generatedArtifactTypes.has(artifact.type);

                  return (
                    <div
                      key={artifact.type}
                      className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                    >
                      <span className="font-mono text-sm">
                        {artifact.filename}
                      </span>

                      <Badge
                        variant={
                          generated
                            ? "default"
                            : "outline"
                        }
                      >
                        {generated
                          ? "Generado"
                          : "Pendiente"}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                {projectModel ? (
                  <Button className="w-full" asChild>
                    <Link href={`/projects/${projectRow.id}/documents`}>
                      {generatedDocumentsCount > 0
                        ? "Revisar paquete técnico"
                        : "Generar paquete técnico"}
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    Genera primero el análisis
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
