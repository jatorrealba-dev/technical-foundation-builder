"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { FoundationProject } from "@/domain/projects/project";
import { ProjectModel } from "@/domain/project-model/project-model";
import { getLocalProjectById } from "@/lib/local-project-store";
import {
  generateLocalProjectModel,
  getProjectModel,
} from "@/lib/local-project-model-store";
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

export default function ProjectAnalysisPage() {
  const params = useParams<{ projectId: string }>();

  const [project, setProject] = useState<FoundationProject | null>(null);
  const [model, setModel] = useState<ProjectModel | null>(null);

  useEffect(() => {
    const loadedProject = getLocalProjectById(params.projectId);
    const loadedModel = getProjectModel(params.projectId);

    setProject(loadedProject);
    setModel(loadedModel);
  }, [params.projectId]);

  function handleGenerateModel() {
    const nextModel = generateLocalProjectModel(params.projectId);
    setModel(nextModel);
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
              <Badge variant="secondary">Project Model</Badge>
              <Badge variant={model ? "default" : "outline"}>
                {model ? "Generado" : "Pendiente"}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Análisis inicial
            </h1>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              Este análisis convierte las respuestas de entrevista en una
              primera estructura de requisitos, supuestos, entidades, riesgos y
              preguntas abiertas.
            </p>
          </div>

          <Button onClick={handleGenerateModel}>
            {model ? "Regenerar análisis" : "Generar análisis inicial"}
          </Button>
        </header>

        {!model ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay análisis generado</CardTitle>
              <CardDescription>
                Responde la entrevista y luego genera el Project Model inicial.
                Por ahora la extracción es local y básica; luego conectaremos IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild variant="outline">
                <Link href={`/projects/${project.id}/interview`}>
                  Ir a entrevista
                </Link>
              </Button>
              <Button onClick={handleGenerateModel}>Generar ahora</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Requisitos detectados</CardTitle>
                  <CardDescription>
                    Capacidades o condiciones que el producto debería cumplir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {model.requirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No se detectaron requisitos todavía.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.requirements.map((requirement) => (
                        <div key={requirement.id} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{requirement.priority}</Badge>
                            <Badge variant="outline">{requirement.type}</Badge>
                            <Badge variant="secondary">
                              {requirement.status}
                            </Badge>
                          </div>
                          <p className="font-medium">{requirement.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {requirement.description}
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
                  <CardTitle>Entidades de dominio</CardTitle>
                  <CardDescription>
                    Objetos principales del negocio detectados desde la
                    entrevista.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {model.domainEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No se detectaron entidades todavía.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {model.domainEntities.map((entity) => (
                        <div key={entity.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{entity.status}</Badge>
                            <p className="font-medium">{entity.name}</p>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {entity.description}
                          </p>
                          <Separator />
                        </div>
                      ))}
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
                      {model.assumptions.map((assumption) => (
                        <div key={assumption.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{assumption.impact}</Badge>
                            <Badge variant="secondary">
                              {assumption.status}
                            </Badge>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {assumption.statement}
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
                  <CardTitle>Riesgos</CardTitle>
                  <CardDescription>
                    Problemas potenciales que deben gestionarse.
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
                        <div key={risk.id} className="space-y-2">
                          <p className="font-medium">{risk.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {risk.description}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Mitigación:</span>{" "}
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
                  <CardTitle>Preguntas abiertas</CardTitle>
                  <CardDescription>
                    Información pendiente antes de una especificación completa.
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
                        <div key={item.id} className="space-y-2">
                          <Badge variant="outline">{item.priority}</Badge>
                          <p className="font-medium">{item.question}</p>
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
