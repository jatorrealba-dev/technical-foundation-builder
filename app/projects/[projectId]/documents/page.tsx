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

import { generateProductSpecAction } from "./actions";

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

async function generateProductSpecFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const result = await generateProductSpecAction({
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

  const { data: artifactData, error: artifactError } =
    await supabase
      .from("artifacts")
      .select(
        "id, project_id, type, title, filename, format, content, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .eq("type", "product_spec")
      .maybeSingle();

  if (artifactError) {
    throw new Error(artifactError.message);
  }

  const productSpec = artifactData
    ? mapArtifact(
        artifactData as unknown as ArtifactRow
      )
    : null;

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

        <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Documentos
              </Badge>

              <Badge
                variant={
                  productSpec
                    ? "default"
                    : "outline"
                }
              >
                {productSpec
                  ? "PRODUCT_SPEC.md generado"
                  : "Pendiente"}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Documentos del proyecto
            </h1>

            <p className="mt-2 font-medium">
              {project.name}
            </p>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              Genera documentos técnicos desde el Project
              Model estructurado y persistido en Supabase.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {productSpec ? (
              <DownloadArtifactButton
                filename={productSpec.filename}
                content={productSpec.content}
                label="Descargar PRODUCT_SPEC.md"
              />
            ) : null}

            <form action={generateProductSpecFormAction}>
              <input
                type="hidden"
                name="projectId"
                value={project.id}
              />

              <Button type="submit">
                {productSpec
                  ? "Regenerar Product Spec"
                  : "Generar Product Spec"}
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

        {!productSpec ? (
          <Card>
            <CardHeader>
              <CardTitle>
                No hay documentos generados
              </CardTitle>

              <CardDescription>
                Primero completa la entrevista y genera el
                análisis inicial. El Product Spec se construirá
                desde el Project Model guardado en Supabase.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" asChild>
                <Link
                  href={`/projects/${project.id}/interview`}
                >
                  Ir a entrevista
                </Link>
              </Button>

              <Button variant="outline" asChild>
                <Link
                  href={`/projects/${project.id}/analysis`}
                >
                  Ver análisis inicial
                </Link>
              </Button>

              <form action={generateProductSpecFormAction}>
                <input
                  type="hidden"
                  name="projectId"
                  value={project.id}
                />

                <Button type="submit">
                  Generar Product Spec
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>
                      {productSpec.filename}
                    </CardTitle>

                    <CardDescription>
                      Última actualización:{" "}
                      {formatDate(
                        productSpec.updatedAt
                      )}
                    </CardDescription>
                  </div>

                  <Badge variant="outline">
                    {productSpec.format}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-5 text-sm leading-7">
                  {productSpec.content}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  );
}
