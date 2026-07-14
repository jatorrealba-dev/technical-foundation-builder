import Link from "next/link";
import { redirect } from "next/navigation";

import { DownloadArtifactButton } from "@/components/artifacts/download-artifact-button";
import { DownloadPackageButton } from "@/components/artifacts/download-package-button";
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
  artifactCatalog,
  artifactTypes,
  isArtifactType,
} from "@/domain/artifacts/artifact-catalog";
import type {
  ArtifactType,
  GeneratedArtifact,
} from "@/domain/artifacts/artifact";
import { createClient } from "@/lib/supabase/server";

import {
  generateArchitectureAction,
  generateBacklogAction,
  generateDataModelAction,
  generateDomainModelAction,
  generateMvpScopeAction,
  generatePackageAction,
  generateProductSpecAction,
  generateSecurityAction,
  generateVerticalSlicePlanAction,
  type GenerateDocumentResult,
} from "./actions";

type ProjectDocumentsPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
};

type ArtifactRow = {
  id: string;
  project_id: string;
  type: GeneratedArtifact["type"];
  title: string;
  filename: string;
  format: GeneratedArtifact["format"];
  content: string;
  created_at: string;
  updated_at: string;
};

type ArtifactVersionReferenceRow = {
  artifact_id: string;
};

function mapArtifact(row: ArtifactRow): GeneratedArtifact {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    filename: row.filename,
    format: row.format,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function executeGenerateAction(input: {
  artifactType: ArtifactType;
  projectId: string;
}): Promise<GenerateDocumentResult> {
  switch (input.artifactType) {
    case "product_spec":
      return generateProductSpecAction({
        projectId: input.projectId,
      });

    case "mvp_scope":
      return generateMvpScopeAction({
        projectId: input.projectId,
      });

    case "domain_model":
      return generateDomainModelAction({
        projectId: input.projectId,
      });

    case "architecture":
      return generateArchitectureAction({
        projectId: input.projectId,
      });

    case "data_model":
      return generateDataModelAction({
        projectId: input.projectId,
      });

    case "security":
      return generateSecurityAction({
        projectId: input.projectId,
      });

    case "backlog":
      return generateBacklogAction({
        projectId: input.projectId,
      });

    case "vertical_slice_plan":
      return generateVerticalSlicePlanAction({
        projectId: input.projectId,
      });
  }
}

async function generateDocumentFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const artifactTypeValue = String(
    formData.get("artifactType") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!isArtifactType(artifactTypeValue)) {
    redirect(
      `/projects/${projectId}/documents?error=${encodeURIComponent(
        "El tipo de documento seleccionado no es válido."
      )}`
    );
  }

  const result = await executeGenerateAction({
    artifactType: artifactTypeValue,
    projectId,
  });

  if (!result.ok) {
    redirect(
      `/projects/${projectId}/documents?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  redirect(`/projects/${projectId}/documents`);
}

async function generatePackageFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const result = await generatePackageAction({
    projectId,
  });

  if (!result.ok) {
    redirect(
      `/projects/${projectId}/documents?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  redirect(`/projects/${projectId}/documents`);
}

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: ProjectDocumentsPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const errorParam = resolvedSearchParams.error;

  const actionError = Array.isArray(errorParam)
    ? errorParam[0]
    : errorParam;

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
    data: artifactRows,
    error: artifactsError,
  } = await supabase
    .from("artifacts")
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .in("type", [...artifactTypes])
    .order("created_at", {
      ascending: true,
    });

  if (artifactsError) {
    throw new Error(artifactsError.message);
  }

  const artifacts = (
    (artifactRows ?? []) as unknown as ArtifactRow[]
  ).map(mapArtifact);

  const artifactIds = artifacts.map(
    (artifact) => artifact.id
  );

  let versionRows: ArtifactVersionReferenceRow[] = [];

  if (artifactIds.length > 0) {
    const {
      data: artifactVersionRows,
      error: artifactVersionsError,
    } = await supabase
      .from("artifact_versions")
      .select("artifact_id")
      .in("artifact_id", artifactIds);

    if (artifactVersionsError) {
      throw new Error(
        artifactVersionsError.message
      );
    }

    versionRows =
      (artifactVersionRows ?? []) as unknown as ArtifactVersionReferenceRow[];
  }

  const versionCountByArtifactId =
    versionRows.reduce<Map<string, number>>(
      (counts, version) => {
        counts.set(
          version.artifact_id,
          (counts.get(version.artifact_id) ?? 0) + 1
        );

        return counts;
      },
      new Map()
    );

  const generatedCount =
    artifactCatalog.filter((definition) =>
      artifacts.some(
        (artifact) =>
          artifact.type === definition.type
      )
    ).length;

  const packageIsComplete =
    generatedCount === artifactCatalog.length;

  const downloadableArtifacts = artifacts.map(
    (artifact) => ({
      filename: artifact.filename,
      content: artifact.content,
    })
  );

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

        <header className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Documentos
              </Badge>

              <Badge
                variant={
                  generatedCount > 0
                    ? "default"
                    : "outline"
                }
              >
                {generatedCount} de{" "}
                {artifactCatalog.length} generados
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Documentos del proyecto
            </h1>

            <p className="mt-2 font-medium">
              {project.name}
            </p>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              Genera artefactos técnicos desde el Project
              Model estructurado y persistido en Supabase.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row">
            {packageIsComplete ? (
              <DownloadPackageButton
                projectName={project.name}
                artifacts={downloadableArtifacts}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
              >
                Descargar paquete ZIP
              </Button>
            )}

            <form action={generatePackageFormAction}>
              <input
                type="hidden"
                name="projectId"
                value={project.id}
              />

              <Button type="submit" size="lg">
                {packageIsComplete
                  ? "Regenerar paquete completo"
                  : "Generar paquete completo"}
              </Button>
            </form>
          </div>
        </header>

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo generar el documento
              </CardTitle>

              <CardDescription>
                {actionError}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              Generación y exportación del paquete
            </CardTitle>

            <CardDescription>
              Genera, actualiza y descarga los ocho documentos
              técnicos del proyecto.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              Estado:{" "}
              <span className="font-medium text-foreground">
                {packageIsComplete
                  ? "Paquete completo"
                  : `${generatedCount} de ${artifactCatalog.length} documentos`}
              </span>
            </p>

            <p>
              La descarga ZIP se habilita cuando los ocho
              documentos están disponibles.
            </p>

            <p>
              Cada regeneración actualiza el documento vigente y
              conserva una versión inmutable en el historial.
            </p>

            <p>
              La tabla principal mantiene una sola fila por tipo
              mediante la restricción{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                project_id + type
              </code>
              .
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {artifactCatalog.map((definition) => {
            const artifact = artifacts.find(
              (item) =>
                item.type === definition.type
            );

            const versionCount = artifact
              ? versionCountByArtifactId.get(
                  artifact.id
                ) ?? 0
              : 0;

            return (
              <Card key={definition.type}>
                <CardHeader>
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            artifact
                              ? "default"
                              : "outline"
                          }
                        >
                          {artifact
                            ? "Generado"
                            : "Pendiente"}
                        </Badge>

                        <Badge variant="outline">
                          markdown
                        </Badge>

                        {artifact ? (
                          <Badge variant="secondary">
                            {versionCount}{" "}
                            {versionCount === 1
                              ? "versión"
                              : "versiones"}
                          </Badge>
                        ) : null}
                      </div>

                      <CardTitle>
                        {definition.filename}
                      </CardTitle>

                      <CardDescription className="mt-2 max-w-2xl">
                        {definition.description}
                      </CardDescription>

                      {artifact ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Última actualización:{" "}
                          {formatDate(
                            artifact.updatedAt
                          )}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {artifact ? (
                        <>
                          <Button
                            variant="outline"
                            asChild
                          >
                            <Link
                              href={`/projects/${project.id}/documents/${definition.type}`}
                            >
                              Abrir historial ({versionCount})
                            </Link>
                          </Button>

                          <DownloadArtifactButton
                            filename={artifact.filename}
                            content={artifact.content}
                            label={`Descargar ${artifact.filename}`}
                          />
                        </>
                      ) : null}

                      <form
                        action={
                          generateDocumentFormAction
                        }
                      >
                        <input
                          type="hidden"
                          name="projectId"
                          value={project.id}
                        />

                        <input
                          type="hidden"
                          name="artifactType"
                          value={definition.type}
                        />

                        <Button type="submit">
                          {artifact
                            ? `Regenerar ${definition.filename}`
                            : `Generar ${definition.filename}`}
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {artifact ? (
                    <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-5 text-sm leading-7">
                      {artifact.content}
                    </pre>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6">
                      <p className="text-sm text-muted-foreground">
                        Este documento todavía no ha sido
                        generado.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
