import Link from "next/link";
import { redirect } from "next/navigation";

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
import type { GeneratedArtifact } from "@/domain/artifacts/artifact";
import { createClient } from "@/lib/supabase/server";

import {
  generateArchitectureAction,
  generateDomainModelAction,
  generateMvpScopeAction,
  generateProductSpecAction,
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

type SupportedArtifactType =
  | "product_spec"
  | "mvp_scope"
  | "domain_model"
  | "architecture";

type DocumentDefinition = {
  type: SupportedArtifactType;
  title: string;
  filename: string;
  description: string;
};

const documentDefinitions: DocumentDefinition[] = [
  {
    type: "product_spec",
    title: "Product Specification",
    filename: "PRODUCT_SPEC.md",
    description:
      "Describe el producto, sus requisitos, entidades, supuestos, riesgos y preguntas abiertas.",
  },
  {
    type: "mvp_scope",
    title: "MVP Scope",
    filename: "MVP_SCOPE.md",
    description:
      "Delimita la primera versión útil, el alcance incluido, los criterios de aceptación y los bloqueadores.",
  },
  {
    type: "domain_model",
    title: "Domain Model",
    filename: "DOMAIN_MODEL.md",
    description:
      "Documenta el lenguaje ubicuo, las entidades detectadas, capacidades, límites candidatos, relaciones pendientes y reglas del dominio.",
  },
  {
    type: "architecture",
    title: "Software Architecture",
    filename: "ARCHITECTURE.md",
    description:
      "Propone el estilo arquitectónico, las capas, módulos candidatos, responsabilidades de datos, seguridad, integraciones y estrategia de evolución.",
  },
];

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

async function generateDocumentFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const artifactType = String(
    formData.get("artifactType") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const result =
    artifactType === "product_spec"
      ? await generateProductSpecAction({
          projectId,
        })
      : artifactType === "mvp_scope"
        ? await generateMvpScopeAction({
            projectId,
          })
        : artifactType === "domain_model"
          ? await generateDomainModelAction({
              projectId,
            })
          : artifactType === "architecture"
            ? await generateArchitectureAction({
                projectId,
              })
            : {
                ok: false as const,
                error:
                  "El tipo de documento seleccionado no es válido.",
              };

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
    .in("type", [
      "product_spec",
      "mvp_scope",
      "domain_model",
      "architecture",
    ])
    .order("created_at", {
      ascending: true,
    });

  if (artifactsError) {
    throw new Error(artifactsError.message);
  }

  const artifacts = (
    (artifactRows ?? []) as unknown as ArtifactRow[]
  ).map(mapArtifact);

  const generatedCount =
    documentDefinitions.filter((definition) =>
      artifacts.some(
        (artifact) =>
          artifact.type === definition.type
      )
    ).length;

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
              {documentDefinitions.length} generados
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

        <div className="grid gap-6">
          {documentDefinitions.map((definition) => {
            const artifact = artifacts.find(
              (item) =>
                item.type === definition.type
            );

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
                        <DownloadArtifactButton
                          filename={artifact.filename}
                          content={artifact.content}
                          label={`Descargar ${artifact.filename}`}
                        />
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
