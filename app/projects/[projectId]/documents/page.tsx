"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { GeneratedArtifact } from "@/domain/artifacts/artifact";
import { FoundationProject } from "@/domain/projects/project";
import { getLocalProjectById } from "@/lib/local-project-store";
import {
  generateProductSpecArtifact,
  getProjectArtifact,
} from "@/lib/local-artifact-generator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProjectDocumentsPage() {
  const params = useParams<{ projectId: string }>();

  const [project, setProject] = useState<FoundationProject | null>(null);
  const [productSpec, setProductSpec] = useState<GeneratedArtifact | null>(null);

  useEffect(() => {
    const loadedProject = getLocalProjectById(params.projectId);
    const loadedProductSpec = getProjectArtifact(params.projectId, "product_spec");

    setProject(loadedProject);
    setProductSpec(loadedProductSpec);
  }, [params.projectId]);

  function handleGenerateProductSpec() {
    const artifact = generateProductSpecArtifact(params.projectId);
    setProductSpec(artifact);
  }

  if (!project) {
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

        <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Documentos</Badge>
              <Badge variant={productSpec ? "default" : "outline"}>
                {productSpec ? "PRODUCT_SPEC.md generado" : "Pendiente"}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Documentos del proyecto
            </h1>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              Genera documentos técnicos desde el Project Model estructurado.
              Por ahora este módulo crea un Product Spec parcial en Markdown.
            </p>
          </div>

          <Button onClick={handleGenerateProductSpec}>
            {productSpec ? "Regenerar Product Spec" : "Generar Product Spec"}
          </Button>
        </header>

        {!productSpec ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay documentos generados</CardTitle>
              <CardDescription>
                Primero completa la entrevista y genera el análisis inicial.
                También puedes generar el Product Spec ahora usando el modelo
                local disponible.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" asChild>
                <Link href={`/projects/${project.id}/interview`}>
                  Ir a entrevista
                </Link>
              </Button>

              <Button variant="outline" asChild>
                <Link href={`/projects/${project.id}/analysis`}>
                  Ver análisis inicial
                </Link>
              </Button>

              <Button onClick={handleGenerateProductSpec}>
                Generar Product Spec
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>{productSpec.filename}</CardTitle>
                    <CardDescription>
                      Última actualización: {formatDate(productSpec.updatedAt)}
                    </CardDescription>
                  </div>

                  <Badge variant="outline">{productSpec.format}</Badge>
                </div>
              </CardHeader>

              <CardContent>
                <pre className="max-h-[720px] overflow-auto rounded-lg border bg-muted/30 p-5 text-sm leading-7 whitespace-pre-wrap">
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
