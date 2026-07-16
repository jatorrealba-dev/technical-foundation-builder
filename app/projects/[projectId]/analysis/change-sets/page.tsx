import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectModelChangeSetStatus } from "@/domain/project-model/project-model-governance";
import { createClient } from "@/lib/supabase/server";

type ChangeSetsPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
};

type ChangeSetRow = {
  id: string;
  source_type: "agent_run" | "manual";
  title: string;
  status: ProjectModelChangeSetStatus;
  total_change_count: number;
  accepted_change_count: number;
  rejected_change_count: number;
  applied_at: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: ProjectModelChangeSetStatus): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "reviewing":
      return "En revisión";
    case "ready":
      return "Lista para aplicar";
    case "applied":
      return "Aplicada";
    case "rejected":
      return "Cerrada sin aplicar";
    case "cancelled":
      return "Cancelada";
  }
}

export default async function ChangeSetsPage({
  params,
}: ChangeSetsPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw new Error(projectError.message);

  if (!projectData) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Proyecto no encontrado</CardTitle>
              <CardDescription>
                El proyecto no existe o no tienes acceso.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  const project = projectData as unknown as ProjectRow;

  const { data: changeSetRows, error: changeSetsError } = await supabase
    .from("project_model_change_sets")
    .select(
      "id, source_type, title, status, total_change_count, accepted_change_count, rejected_change_count, applied_at, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (changeSetsError) {
    throw new Error(changeSetsError.message);
  }

  const changeSets = (changeSetRows ?? []) as unknown as ChangeSetRow[];

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/analysis`}>
              ← Volver al análisis
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/analysis/edit`}>
              Editar Project Model
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/agents`}>
              Ver agentes
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <Badge variant="secondary">Project Model Governance</Badge>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Propuestas de cambios
          </h1>
          <p className="mt-2 font-medium">{project.name}</p>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Cada propuesta conserva su origen, decisiones por
            elemento, aplicación transaccional y versión resultante.
          </p>
        </header>

        {changeSets.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin propuestas todavía</CardTitle>
              <CardDescription>
                Aprueba una ejecución de Project Model Analyst y
                prepara una revisión granular, o edita el modelo
                manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/projects/${projectId}/agents`}>
                  Ir a agentes
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/projects/${projectId}/analysis/edit`}>
                  Editar manualmente
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {changeSets.map((changeSet) => (
              <Card key={changeSet.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{getStatusLabel(changeSet.status)}</Badge>
                    <Badge variant="outline">
                      {changeSet.source_type === "manual"
                        ? "Manual"
                        : "IA"}
                    </Badge>
                    <Badge variant="secondary">
                      {changeSet.total_change_count} cambios
                    </Badge>
                  </div>
                  <CardTitle className="mt-3">
                    {changeSet.title}
                  </CardTitle>
                  <CardDescription>
                    Creada el {formatDate(changeSet.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <p>
                      <span className="font-medium">Aceptados:</span>{" "}
                      {changeSet.accepted_change_count}
                    </p>
                    <p>
                      <span className="font-medium">Rechazados:</span>{" "}
                      {changeSet.rejected_change_count}
                    </p>
                    <p>
                      <span className="font-medium">Aplicación:</span>{" "}
                      {changeSet.applied_at
                        ? formatDate(changeSet.applied_at)
                        : "Pendiente"}
                    </p>
                  </div>
                  <Button asChild>
                    <Link
                      href={`/projects/${projectId}/analysis/change-sets/${changeSet.id}`}
                    >
                      Abrir propuesta
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
