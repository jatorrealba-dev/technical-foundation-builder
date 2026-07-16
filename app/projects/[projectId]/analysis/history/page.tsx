import Link from "next/link";
import { redirect } from "next/navigation";

import { DownloadProjectModelVersionButton } from "@/components/project-model/download-project-model-version-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";

import { RestoreProjectModelVersionForm } from "./restore-project-model-version-form";

type ProjectModelHistoryPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    restored?: string | string[];
    current?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  organization_id: string;
};

type MembershipRow = {
  role: string;
};

type ProjectModelVersionRow = {
  id: string;
  project_model_id: string;
  project_id: string;
  version_number: number;
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
  source_run_id: string | null;
  source_review_id: string | null;
  source_change_set_id: string | null;
  restored_from_version_id: string | null;
  change_reason: string;
  created_by: string | null;
  created_at: string;
};

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function createVersionSnapshot(
  version: ProjectModelVersionRow
) {
  return {
    versionNumber: version.version_number,
    projectId: version.project_id,
    status: version.status,
    requirements: version.requirements,
    assumptions: version.assumptions,
    domainEntities: version.domain_entities,
    risks: version.risks,
    openQuestions: version.open_questions,
    sourceRunId: version.source_run_id,
    sourceReviewId: version.source_review_id,
    sourceChangeSetId: version.source_change_set_id,
    restoredFromVersionId:
      version.restored_from_version_id,
    changeReason: version.change_reason,
    createdBy: version.created_by,
    createdAt: version.created_at,
  };
}

export default async function ProjectModelHistoryPage({
  params,
  searchParams,
}: ProjectModelHistoryPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const actionError = firstSearchParam(
    resolvedSearchParams.error
  );

  const restoredVersion = firstSearchParam(
    resolvedSearchParams.restored
  );

  const currentVersion = firstSearchParam(
    resolvedSearchParams.current
  );

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
    .select("id, name, organization_id")
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

  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipRole = membershipData
    ? (membershipData as unknown as MembershipRow).role
    : null;

  const canRestore =
    canManageAgentReviews(membershipRole);

  const {
    data: versionRows,
    error: versionsError,
  } = await supabase
    .from("project_model_versions")
    .select(
      "id, project_model_id, project_id, version_number, status, requirements, assumptions, domain_entities, risks, open_questions, source_run_id, source_review_id, source_change_set_id, restored_from_version_id, change_reason, created_by, created_at"
    )
    .eq("project_id", projectId)
    .order("version_number", {
      ascending: false,
    });

  const versionsAvailable = !versionsError;

  const versions = versionsAvailable
    ? (versionRows ?? []) as unknown as ProjectModelVersionRow[]
    : [];

  const latestVersionNumber =
    versions[0]?.version_number ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link
              href={`/projects/${project.id}/analysis`}
            >
              ← Volver al análisis
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}`}>
              Ver proyecto
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link
              href={`/projects/${project.id}/documents`}
            >
              Ver documentos
            </Link>
          </Button>
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Project Model History
            </Badge>

            <Badge
              variant={
                versions.length > 0
                  ? "default"
                  : "outline"
              }
            >
              {versions.length} {versions.length === 1
                ? "versión"
                : "versiones"}
            </Badge>

            {latestVersionNumber > 0 ? (
              <Badge variant="outline">
                Vigente: v{latestVersionNumber}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Historial del Project Model
          </h1>

          <p className="mt-2 font-medium">
            {project.name}
          </p>

          <p className="mt-3 max-w-3xl text-muted-foreground">
            Cada cambio estructurado conserva un snapshot
            inmutable. Restaurar una versión crea un nuevo estado
            vigente y regenera el paquete documental sin eliminar
            el historial anterior.
          </p>
        </header>

        {restoredVersion ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                Project Model restaurado
              </CardTitle>
              <CardDescription>
                La versión {restoredVersion} fue restaurada como
                la nueva versión {currentVersion ?? "vigente"} y
                los ocho documentos fueron regenerados.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo completar la operación
              </CardTitle>
              <CardDescription>
                {actionError}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!versionsAvailable ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                Migración de historial pendiente
              </CardTitle>
              <CardDescription>
                Aplica 0008_stabilize_human_review_workflow.sql.
                Detalle: {versionsError?.message}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : versions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Sin versiones todavía
              </CardTitle>
              <CardDescription>
                Genera el Project Model para crear el primer
                snapshot histórico.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-5">
            {versions.map((version) => {
              const isCurrent =
                version.version_number ===
                latestVersionNumber;

              const snapshot =
                createVersionSnapshot(version);

              return (
                <Card key={version.id}>
                  <CardHeader>
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              isCurrent
                                ? "default"
                                : "outline"
                            }
                          >
                            Versión {version.version_number}
                          </Badge>

                          <Badge variant="secondary">
                            {isCurrent
                              ? "Vigente"
                              : "Histórica"}
                          </Badge>

                          <Badge variant="outline">
                            {version.status}
                          </Badge>

                          {version.source_run_id ? (
                            <Badge variant="outline">
                              Origen: agente IA
                            </Badge>
                          ) : null}

                          {version.source_change_set_id ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/projects/${project.id}/analysis/change-sets/${version.source_change_set_id}`}
                              >
                                Ver propuesta
                              </Link>
                            </Button>
                          ) : null}

                          {version.restored_from_version_id ? (
                            <Badge variant="outline">
                              Restauración
                            </Badge>
                          ) : null}
                        </div>

                        <CardTitle className="text-xl">
                          {version.change_reason}
                        </CardTitle>

                        <CardDescription className="mt-2">
                          Creada el {formatDate(
                            version.created_at
                          )}
                        </CardDescription>
                      </div>

                      <DownloadProjectModelVersionButton
                        filename={`project-model-v${version.version_number}.json`}
                        value={snapshot}
                        label={`Descargar v${version.version_number}`}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-md border p-3">
                        <p className="font-medium">
                          Requisitos
                        </p>
                        <p className="text-muted-foreground">
                          {version.requirements.length}
                        </p>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">
                          Supuestos
                        </p>
                        <p className="text-muted-foreground">
                          {version.assumptions.length}
                        </p>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">
                          Entidades
                        </p>
                        <p className="text-muted-foreground">
                          {version.domain_entities.length}
                        </p>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">
                          Riesgos
                        </p>
                        <p className="text-muted-foreground">
                          {version.risks.length}
                        </p>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">
                          Preguntas
                        </p>
                        <p className="text-muted-foreground">
                          {version.open_questions.length}
                        </p>
                      </div>
                    </div>

                    <details className="rounded-lg border bg-muted/20">
                      <summary className="cursor-pointer px-5 py-4 font-medium">
                        Ver snapshot estructurado
                      </summary>

                      <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap border-t p-5 text-xs leading-6">
                        {JSON.stringify(
                          snapshot,
                          null,
                          2
                        )}
                      </pre>
                    </details>

                    {!isCurrent && canRestore ? (
                      <RestoreProjectModelVersionForm
                        projectId={project.id}
                        versionId={version.id}
                        versionNumber={
                          version.version_number
                        }
                      />
                    ) : null}

                    {!isCurrent && !canRestore ? (
                      <p className="text-sm text-muted-foreground">
                        Solo un owner o admin puede restaurar una
                        versión histórica del Project Model.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
