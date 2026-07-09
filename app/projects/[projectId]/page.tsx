"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { FoundationProject } from "@/domain/projects/project";
import { getLocalProjectById } from "@/lib/local-project-store";
import { getInterviewCompletionPercentage } from "@/lib/local-interview-store";
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

const plannedDocuments = [
  "PRODUCT_SPEC.md",
  "MVP_SCOPE.md",
  "DOMAIN_MODEL.md",
  "ARCHITECTURE.md",
  "DATA_MODEL.md",
  "SECURITY.md",
  "BACKLOG.md",
  "VERTICAL_SLICE_PLAN.md",
];

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const [project, setProject] = useState<FoundationProject | null>(null);
  const [completion, setCompletion] = useState(0);

  useEffect(() => {
    const loadedProject = getLocalProjectById(params.projectId);

    setProject(loadedProject);

    if (loadedProject) {
      setCompletion(getInterviewCompletionPercentage(loadedProject.id));
    }
  }, [params.projectId]);

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
            <Link href="/dashboard">← Volver al dashboard</Link>
          </Button>
        </div>

        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">{project.status}</Badge>
              <Badge variant="outline">{project.productType}</Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              {project.name}
            </h1>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              {project.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/analysis`}>
                Ver análisis inicial
              </Link>
            </Button>

            <Button asChild>
              <Link href={`/projects/${project.id}/interview`}>
                Iniciar entrevista
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
                  Datos iniciales usados para comenzar el descubrimiento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Industria</p>
                  <p className="text-muted-foreground">
                    {project.industry || "No definida"}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">Nivel técnico</p>
                  <p className="text-muted-foreground">
                    {project.technicalLevel}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">Objetivo principal</p>
                  <p className="text-muted-foreground">
                    {project.mainGoal || "No definido"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Readiness inicial</CardTitle>
                <CardDescription>
                  Este puntaje será calculado con base en información
                  confirmada, supuestos, riesgos y preguntas abiertas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={Math.max(12, completion)} />
                <p className="text-sm text-muted-foreground">
                  {Math.max(12, completion)}% — Proyecto creado
                  {completion > 0 ? ", entrevista iniciada." : ", entrevista pendiente."}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paquete técnico planeado</CardTitle>
              <CardDescription>
                Estos documentos se generarán desde el Project Model
                estructurado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {plannedDocuments.map((documentName) => (
                  <div
                    key={documentName}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {documentName}
                    </span>
                    <Badge variant="outline">Pendiente</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
