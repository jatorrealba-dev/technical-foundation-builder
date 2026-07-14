import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { DownloadArtifactButton } from "@/components/artifacts/download-artifact-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getArtifactDefinition,
  isArtifactType,
} from "@/domain/artifacts/artifact-catalog";
import type {
  ArtifactFormat,
  ArtifactType,
} from "@/domain/artifacts/artifact";
import { createClient } from "@/lib/supabase/server";

type ArtifactHistoryPageProps = {
  params: Promise<{
    projectId: string;
    artifactType: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
};

type ArtifactRow = {
  id: string;
  project_id: string;
  type: ArtifactType;
  title: string;
  filename: string;
  format: ArtifactFormat;
  content: string;
  created_at: string;
  updated_at: string;
};

type ArtifactVersionRow = {
  id: string;
  artifact_id: string;
  version_number: number;
  title: string;
  filename: string;
  format: ArtifactFormat;
  content: string;
  source_snapshot: unknown;
  generated_by: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasSnapshotProperty(
  snapshot: unknown,
  property: "project" | "project_model"
): boolean {
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    return false;
  }

  const record = snapshot as Record<
    string,
    unknown
  >;

  return (
    property in record &&
    record[property] !== null
  );
}

export default async function ArtifactHistoryPage({
  params,
}: ArtifactHistoryPageProps) {
  const {
    projectId,
    artifactType: artifactTypeValue,
  } = await params;

  if (!isArtifactType(artifactTypeValue)) {
    notFound();
  }

  const artifactType = artifactTypeValue;
  const definition =
    getArtifactDefinition(artifactType);

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
                El proyecto no existe o no tienes
                acceso.
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
    data: artifactData,
    error: artifactError,
  } = await supabase
    .from("artifacts")
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("type", artifactType)
    .maybeSingle();

  if (artifactError) {
    throw new Error(artifactError.message);
  }

  const artifact = artifactData
    ? (artifactData as unknown as ArtifactRow)
    : null;

  const versions: ArtifactVersionRow[] = [];

  if (artifact) {
    const {
      data: versionRows,
      error: versionsError,
    } = await supabase
      .from("artifact_versions")
      .select(
        "id, artifact_id, version_number, title, filename, format, content, source_snapshot, generated_by, created_at"
      )
      .eq("artifact_id", artifact.id)
      .order("version_number", {
        ascending: false,
      });

    if (versionsError) {
      throw new Error(versionsError.message);
    }

    versions.push(
      ...((versionRows ?? []) as unknown as ArtifactVersionRow[])
    );
  }

  const latestVersionNumber =
    versions[0]?.version_number ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link
              href={`/projects/${project.id}/documents`}
            >
              ← Volver a documentos
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}`}>
              Ver proyecto
            </Link>
          </Button>
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Historial de versiones
            </Badge>

            <Badge
              variant={
                versions.length > 0
                  ? "default"
                  : "outline"
              }
            >
              {versions.length}{" "}
              {versions.length === 1
                ? "versión"
                : "versiones"}
            </Badge>

            {latestVersionNumber > 0 ? (
              <Badge variant="outline">
                Actual: v{latestVersionNumber}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            {definition.filename}
          </h1>

          <p className="mt-2 font-medium">
            {project.name}
          </p>

          <p className="mt-3 max-w-3xl text-muted-foreground">
            Consulta el documento vigente y todas las
            versiones inmutables creadas durante sus
            regeneraciones.
          </p>
        </header>

        {!artifact ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Documento pendiente
              </CardTitle>

              <CardDescription>
                {definition.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este artefacto todavía no ha sido
                generado, por lo que no existe historial
                de versiones.
              </p>

              <Button asChild>
                <Link
                  href={`/projects/${project.id}/documents`}
                >
                  Ir a generar el documento
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader>
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge>
                        Documento actual
                      </Badge>

                      <Badge variant="outline">
                        {artifact.format}
                      </Badge>
                    </div>

                    <CardTitle>
                      {artifact.title}
                    </CardTitle>

                    <CardDescription className="mt-2">
                      Última actualización:{" "}
                      {formatDate(
                        artifact.updated_at
                      )}
                    </CardDescription>
                  </div>

                  <DownloadArtifactButton
                    filename={artifact.filename}
                    content={artifact.content}
                    label={`Descargar ${artifact.filename}`}
                  />
                </div>
              </CardHeader>

              <CardContent>
                <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-5 text-sm leading-7">
                  {artifact.content}
                </pre>
              </CardContent>
            </Card>

            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight">
                Versiones guardadas
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Cada versión conserva el contenido y el
                snapshot del proyecto utilizado durante
                la generación.
              </p>
            </div>

            {versions.length > 0 ? (
              <div className="grid gap-5">
                {versions.map((version) => {
                  const isCurrentVersion =
                    version.version_number ===
                    latestVersionNumber;

                  const hasProjectSnapshot =
                    hasSnapshotProperty(
                      version.source_snapshot,
                      "project"
                    );

                  const hasModelSnapshot =
                    hasSnapshotProperty(
                      version.source_snapshot,
                      "project_model"
                    );

                  return (
                    <Card key={version.id}>
                      <CardHeader>
                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                          <div>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  isCurrentVersion
                                    ? "default"
                                    : "outline"
                                }
                              >
                                Versión{" "}
                                {version.version_number}
                              </Badge>

                              {isCurrentVersion ? (
                                <Badge variant="secondary">
                                  Vigente
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  Histórica
                                </Badge>
                              )}

                              <Badge variant="outline">
                                {version.format}
                              </Badge>
                            </div>

                            <CardTitle className="text-xl">
                              {version.filename}
                            </CardTitle>

                            <CardDescription className="mt-2">
                              Creada el{" "}
                              {formatDate(
                                version.created_at
                              )}
                            </CardDescription>
                          </div>

                          <DownloadArtifactButton
                            filename={
                              version.filename.replace(
                                /\.md$/i,
                                `-v${version.version_number}.md`
                              )
                            }
                            content={version.content}
                            label={`Descargar v${version.version_number}`}
                          />
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {version.generated_by
                              ? "Usuario autenticado"
                              : "Migración inicial"}
                          </Badge>

                          <Badge
                            variant={
                              hasProjectSnapshot
                                ? "secondary"
                                : "outline"
                            }
                          >
                            Snapshot del proyecto
                          </Badge>

                          <Badge
                            variant={
                              hasModelSnapshot
                                ? "secondary"
                                : "outline"
                            }
                          >
                            Snapshot del Project Model
                          </Badge>
                        </div>

                        <details className="rounded-lg border bg-muted/20">
                          <summary className="cursor-pointer px-5 py-4 font-medium">
                            Ver contenido de la versión{" "}
                            {version.version_number}
                          </summary>

                          <div className="border-t p-5">
                            <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap text-sm leading-7">
                              {version.content}
                            </pre>
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Historial no disponible
                  </CardTitle>

                  <CardDescription>
                    El documento existe, pero no se
                    encontraron versiones registradas.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </>
        )}
      </section>
    </main>
  );
}
