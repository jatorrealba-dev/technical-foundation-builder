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
import { Separator } from "@/components/ui/separator";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";

import { generateProjectModelAction } from "./actions";

type ProjectAnalysisPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    updated?: string | string[];
    changeSet?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
};

type ProjectModelRow = {
  project_id: string;
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
  generated_at: string;
  updated_at: string;
};

function mapProjectModelRow(
  row: ProjectModelRow
): ProjectModel {
  return {
    projectId: row.project_id,
    status: row.status,
    requirements: row.requirements,
    assumptions: row.assumptions,
    domainEntities: row.domain_entities,
    risks: row.risks,
    openQuestions: row.open_questions,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function generateProjectModelFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const result = await generateProjectModelAction({
    projectId,
  });

  if (!result.ok) {
    redirect(
      `/projects/${projectId}/analysis?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  redirect(`/projects/${projectId}/analysis`);
}

export default async function ProjectAnalysisPage({
  params,
  searchParams,
}: ProjectAnalysisPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const errorParam = resolvedSearchParams.error;

  const actionError = Array.isArray(errorParam)
    ? errorParam[0]
    : errorParam;

  const updatedParam = resolvedSearchParams.updated;
  const wasUpdated = Array.isArray(updatedParam)
    ? updatedParam[0] === "1"
    : updatedParam === "1";

  const changeSetParam = resolvedSearchParams.changeSet;
  const updatedChangeSetId = Array.isArray(changeSetParam)
    ? changeSetParam[0]
    : changeSetParam;

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
                El proyecto no existe o no tienes acceso.
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
    projectData as unknown as ProjectRow;

  const { data: modelData, error: modelError } =
    await supabase
      .from("project_models")
      .select(
        "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
      )
      .eq("project_id", projectId)
      .maybeSingle();

  if (modelError) {
    throw new Error(modelError.message);
  }

  const model = modelData
    ? mapProjectModelRow(
        modelData as unknown as ProjectModelRow
      )
    : null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>
              ← Volver al proyecto
            </Link>
          </Button>

          {model ? (
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${project.id}/analysis/history`}
              >
                Ver historial del Project Model
              </Link>
            </Button>
          ) : null}

          {model ? (
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/analysis/edit`}>
                Editar Project Model
              </Link>
            </Button>
          ) : null}

          {model ? (
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${project.id}/analysis/change-sets`}
              >
                Propuestas de cambios
              </Link>
            </Button>
          ) : null}

          {model ? (
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/readiness`}>
                Revisar readiness
              </Link>
            </Button>
          ) : null}

          {model ? (
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/consistency`}>
                Revisar consistencia
              </Link>
            </Button>
          ) : null}
        </div>

        <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Project Model
              </Badge>

              <Badge
                variant={
                  model ? "default" : "outline"
                }
              >
                {model ? "Generado" : "Pendiente"}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Análisis inicial
            </h1>

            <p className="mt-2 font-medium">
              {project.name}
            </p>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              Este análisis convierte las respuestas de
              entrevista en una primera estructura de
              requisitos, supuestos, entidades, riesgos y
              preguntas abiertas.
            </p>

            {model ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Última generación:{" "}
                {formatDate(model.generatedAt)}
              </p>
            ) : null}
          </div>

          <form action={generateProjectModelFormAction}>
            <input
              type="hidden"
              name="projectId"
              value={project.id}
            />

            <Button type="submit">
              {model
                ? "Regenerar análisis"
                : "Generar análisis inicial"}
            </Button>
          </form>
        </header>

        {wasUpdated ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Project Model actualizado</CardTitle>
              <CardDescription>
                Se creó una nueva versión y se regeneraron solo
                los documentos afectados.
                {updatedChangeSetId ? (
                  <>
                    {" "}
                    <Link
                      className="underline"
                      href={`/projects/${project.id}/analysis/change-sets/${updatedChangeSetId}`}
                    >
                      Ver propuesta aplicada
                    </Link>
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo generar el análisis
              </CardTitle>

              <CardDescription>
                {actionError}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!model ? (
          <Card>
            <CardHeader>
              <CardTitle>
                No hay análisis generado
              </CardTitle>

              <CardDescription>
                Responde al menos una pregunta de la
                entrevista y luego genera el Project Model
                inicial.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link
                  href={`/projects/${project.id}/interview`}
                >
                  Ir a entrevista
                </Link>
              </Button>

              <form action={generateProjectModelFormAction}>
                <input
                  type="hidden"
                  name="projectId"
                  value={project.id}
                />

                <Button type="submit">
                  Generar ahora
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Requisitos detectados
                  </CardTitle>

                  <CardDescription>
                    Capacidades o condiciones que el producto
                    debería cumplir.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {model.requirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No se detectaron requisitos todavía.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.requirements.map(
                        (requirement) => (
                          <div
                            key={requirement.id}
                            className="space-y-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>
                                {requirement.priority}
                              </Badge>

                              <Badge variant="outline">
                                {requirement.type}
                              </Badge>

                              <Badge variant="secondary">
                                {requirement.status}
                              </Badge>
                            </div>

                            <p className="font-medium">
                              {requirement.title}
                            </p>

                            <p className="text-sm leading-6 text-muted-foreground">
                              {requirement.description}
                            </p>

                            <Separator />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Entidades de dominio
                  </CardTitle>

                  <CardDescription>
                    Objetos principales del negocio detectados
                    desde la entrevista.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {model.domainEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No se detectaron entidades todavía.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.domainEntities.map(
                        (entity) => (
                          <div
                            key={entity.id}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {entity.status}
                              </Badge>

                              <p className="font-medium">
                                {entity.name}
                              </p>
                            </div>

                            <p className="text-sm leading-6 text-muted-foreground">
                              {entity.description}
                            </p>

                            <Separator />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Supuestos</CardTitle>

                  <CardDescription>
                    Inferencias que necesitan confirmación.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {model.assumptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay supuestos detectados.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.assumptions.map(
                        (assumption) => (
                          <div
                            key={assumption.id}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {assumption.impact}
                              </Badge>

                              <Badge variant="secondary">
                                {assumption.status}
                              </Badge>
                            </div>

                            <p className="text-sm leading-6 text-muted-foreground">
                              {assumption.statement}
                            </p>

                            <Separator />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Riesgos</CardTitle>

                  <CardDescription>
                    Problemas potenciales que deben
                    gestionarse.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {model.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay riesgos detectados.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.risks.map((risk) => (
                        <div
                          key={risk.id}
                          className="space-y-2"
                        >
                          <p className="font-medium">
                            {risk.title}
                          </p>

                          <p className="text-sm leading-6 text-muted-foreground">
                            {risk.description}
                          </p>

                          <p className="text-sm">
                            <span className="font-medium">
                              Mitigación:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {risk.mitigation}
                            </span>
                          </p>

                          <Separator />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Preguntas abiertas
                  </CardTitle>

                  <CardDescription>
                    Información pendiente antes de una
                    especificación completa.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {model.openQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay preguntas abiertas críticas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.openQuestions.map((item) => (
                        <div
                          key={item.id}
                          className="space-y-2"
                        >
                          <Badge variant="outline">
                            {item.priority}
                          </Badge>

                          <p className="font-medium">
                            {item.question}
                          </p>

                          <p className="text-sm leading-6 text-muted-foreground">
                            {item.reason}
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
        )}
      </section>
    </main>
  );
}
