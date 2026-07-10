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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

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

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  industry: string;
  product_type: string;
  technical_level: string;
  main_goal: string;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, name, description, industry, product_type, technical_level, main_goal, status, created_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Proyecto no encontrado</CardTitle>

              <CardDescription>
                No existe un proyecto accesible con este identificador.
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

  const projectRow = project as ProjectRow;

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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{projectRow.status}</Badge>

              <Badge variant="outline">{projectRow.product_type}</Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              {projectRow.name}
            </h1>

            <p className="mt-3 max-w-3xl text-muted-foreground">
              {projectRow.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" disabled>
              Documentos: siguiente paso
            </Button>

            <Button variant="outline" disabled>
              Análisis: siguiente paso
            </Button>

            <Button asChild>
              <Link href={`/projects/${projectRow.id}/interview`}>
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
                  Datos iniciales guardados en Supabase.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Industria</p>

                  <p className="text-muted-foreground">
                    {projectRow.industry || "No definida"}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">Nivel técnico</p>

                  <p className="text-muted-foreground">
                    {projectRow.technical_level}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">Objetivo principal</p>

                  <p className="text-muted-foreground">
                    {projectRow.main_goal || "No definido"}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="font-medium">Creado</p>

                  <p className="text-muted-foreground">
                    {formatDate(projectRow.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Readiness inicial</CardTitle>

                <CardDescription>
                  El cálculo real se conectará cuando migremos el análisis y los
                  documentos a Supabase.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <Progress value={12} />

                <p className="text-sm text-muted-foreground">
                  12% — Proyecto creado en Supabase. La entrevista ya está
                  disponible.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paquete técnico planeado</CardTitle>

              <CardDescription>
                Estos documentos se generarán desde el Project Model persistido
                en Supabase.
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
