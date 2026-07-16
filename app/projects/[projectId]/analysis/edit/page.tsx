import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { createClient } from "@/lib/supabase/server";
import type { EditableProjectModelInput } from "@/schemas/project-model/project-model";

import { ProjectModelEditor } from "./project-model-editor";

type ProjectModelEditPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

type ProjectRow = {
  id: string;
  name: string;
  organization_id: string;
};

type ProjectModelRow = {
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
};

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectModelEditPage({
  params,
  searchParams,
}: ProjectModelEditPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const actionError = firstSearchParam(resolvedSearchParams.error);
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, name, organization_id")
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

  const { data: membershipData } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const canManage = canManageAgentReviews(
    membershipData
      ? String((membershipData as { role: string }).role)
      : null
  );

  const { data: modelData, error: modelError } = await supabase
    .from("project_models")
    .select(
      "status, requirements, assumptions, domain_entities, risks, open_questions"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (modelError) throw new Error(modelError.message);

  if (!modelData) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>No existe un Project Model</CardTitle>
              <CardDescription>
                Genera el análisis inicial antes de abrir el editor.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  const { data: versionData, error: versionError } = await supabase
    .from("project_model_versions")
    .select("id")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);

  const row = modelData as unknown as ProjectModelRow;
  const initialModel: EditableProjectModelInput = {
    status: row.status,
    requirements: row.requirements,
    assumptions: row.assumptions,
    domainEntities: row.domain_entities,
    risks: row.risks,
    openQuestions: row.open_questions,
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/analysis`}>
              ← Volver al análisis
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/analysis/change-sets`}>
              Propuestas de cambios
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/analysis/history`}>
              Historial de versiones
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <Badge variant="secondary">Editor gobernado</Badge>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Editar Project Model
          </h1>
          <p className="mt-2 font-medium">{project.name}</p>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Administra requisitos, supuestos, entidades, riesgos y
            preguntas abiertas sin perder historial ni regenerar
            documentos que no fueron afectados.
          </p>
        </header>

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo guardar el Project Model
              </CardTitle>
              <CardDescription>{actionError}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <ProjectModelEditor
          projectId={projectId}
          baseModelVersionId={
            versionData
              ? String((versionData as { id: string }).id)
              : null
          }
          initialModel={initialModel}
          canManage={canManage}
        />
      </section>
    </main>
  );
}
