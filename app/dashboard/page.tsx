"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FoundationProject } from "@/domain/projects/project";
import { getLocalProjects } from "@/lib/local-project-store";
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

export default function DashboardPage() {
  const [projects, setProjects] = useState<FoundationProject[]>([]);

  useEffect(() => {
    setProjects(getLocalProjects());
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Dashboard
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Proyectos de Foundation
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Aquí se listarán las ideas que serán transformadas en paquetes
              técnicos listos para desarrollo.
            </p>
          </div>

          <Button asChild>
            <Link href="/projects/new">Crear proyecto</Link>
          </Button>
        </header>

        {projects.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay proyectos todavía</CardTitle>
              <CardDescription>
                Crea el primer proyecto para comenzar el flujo de entrevista,
                extracción de requisitos y generación documental.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/projects/new">Crear primer proyecto</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription className="mt-2 line-clamp-2">
                        {project.description}
                      </CardDescription>
                    </div>

                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Industria:
                      </span>{" "}
                      {project.industry || "No definida"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Creado:
                      </span>{" "}
                      {formatDate(project.createdAt)}
                    </p>
                  </div>

                  <Button variant="outline" asChild>
                    <Link href={`/projects/${project.id}`}>
                      Abrir proyecto
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
