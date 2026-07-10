"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams } from "next/navigation";

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
import { createClient } from "@/lib/supabase/client";

import { generateProductSpecAction } from "./actions";

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

function mapArtifact(
  row: ArtifactRow
): GeneratedArtifact {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

export default function ProjectDocumentsPage() {
  const params = useParams<{
    projectId: string;
  }>();

  const projectId = params.projectId;

  const [project, setProject] =
    useState<ProjectRow | null>(null);

  const [productSpec, setProductSpec] =
    useState<GeneratedArtifact | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

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
        setProject(null);
        setProductSpec(null);
        return;
      }

      setProject(
        projectData as unknown as ProjectRow
      );

      const {
        data: artifactData,
        error: artifactError,
      } = await supabase
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

      if (!artifactData) {
        setProductSpec(null);
        return;
      }

      setProductSpec(
        mapArtifact(
          artifactData as unknown as ArtifactRow
        )
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  async function handleGenerateProductSpec() {
    setIsGenerating(true);
    setError(null);

    try {
      const result =
        await generateProductSpecAction({
          projectId,
        });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setProductSpec(result.artifact);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>
                Cargando documentos
              </CardTitle>

              <CardDescription>
                Consultando el proyecto y sus artefactos
                en Supabase.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  if (error && !project) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo cargar el proyecto
              </CardTitle>

              <CardDescription>
                {error}
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

  if (!project) {
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

            <Button
              onClick={handleGenerateProductSpec}
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generando..."
                : productSpec
                  ? "Regenerar Product Spec"
                  : "Generar Product Spec"}
            </Button>
          </div>
        </header>

        {error ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo generar el documento
              </CardTitle>

              <CardDescription>
                {error}
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

              <Button
                onClick={handleGenerateProductSpec}
                disabled={isGenerating}
              >
                {isGenerating
                  ? "Generando..."
                  : "Generar Product Spec"}
              </Button>
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
