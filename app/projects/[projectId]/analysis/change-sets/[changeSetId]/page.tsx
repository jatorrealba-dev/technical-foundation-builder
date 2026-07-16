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
import { Separator } from "@/components/ui/separator";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import type {
  ProjectModelChangeCategory,
  ProjectModelChangeDecision,
  ProjectModelChangeOperation,
  ProjectModelChangeSetStatus,
} from "@/domain/project-model/project-model-governance";
import { createClient } from "@/lib/supabase/server";

import {
  ApplyChangeSetForm,
  CloseChangeSetForm,
} from "./change-set-actions";
import { ChangeReviewControls } from "./change-review-controls";

type ChangeSetPageProps = {
  params: Promise<{
    projectId: string;
    changeSetId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    reviewed?: string | string[];
    applied?: string | string[];
    closed?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  organization_id: string;
};

type ChangeSetRow = {
  id: string;
  project_id: string;
  source_type: "agent_run" | "manual";
  source_run_id: string | null;
  title: string;
  summary: Record<string, unknown>;
  status: ProjectModelChangeSetStatus;
  total_change_count: number;
  accepted_change_count: number;
  rejected_change_count: number;
  application_summary: Record<string, unknown>;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChangeRow = {
  id: string;
  category: ProjectModelChangeCategory;
  operation: ProjectModelChangeOperation;
  entity_key: string;
  label: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  decision: ProjectModelChangeDecision;
  reviewer_comment: string | null;
  reviewed_at: string | null;
  impacted_artifact_types: string[];
  display_order: number;
};

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

function getDecisionLabel(
  decision: ProjectModelChangeDecision
): string {
  switch (decision) {
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aceptado";
    case "rejected":
      return "Rechazado";
  }
}

function getOperationLabel(
  operation: ProjectModelChangeOperation
): string {
  switch (operation) {
    case "add":
      return "Agregar";
    case "update":
      return "Modificar";
    case "remove":
      return "Eliminar";
  }
}

function getCategoryLabel(
  category: ProjectModelChangeCategory
): string {
  switch (category) {
    case "requirement":
      return "Requisito";
    case "assumption":
      return "Supuesto";
    case "domain_entity":
      return "Entidad de dominio";
    case "risk":
      return "Riesgo";
    case "open_question":
      return "Pregunta abierta";
    case "model_status":
      return "Estado del modelo";
  }
}

function valuePreview(value: Record<string, unknown> | null) {
  if (!value) {
    return (
      <p className="text-sm text-muted-foreground">No aplica.</p>
    );
  }

  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-4 text-xs leading-6">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function ChangeSetPage({
  params,
  searchParams,
}: ChangeSetPageProps) {
  const { projectId, changeSetId } = await params;
  const resolvedSearchParams = await searchParams;
  const actionError = firstSearchParam(resolvedSearchParams.error);
  const reviewed = firstSearchParam(resolvedSearchParams.reviewed);
  const applied = firstSearchParam(resolvedSearchParams.applied);
  const closed = firstSearchParam(resolvedSearchParams.closed);

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

  const { data: changeSetData, error: changeSetError } = await supabase
    .from("project_model_change_sets")
    .select(
      "id, project_id, source_type, source_run_id, title, summary, status, total_change_count, accepted_change_count, rejected_change_count, application_summary, applied_at, created_at, updated_at"
    )
    .eq("id", changeSetId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (changeSetError) throw new Error(changeSetError.message);

  if (!changeSetData) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Propuesta no encontrada</CardTitle>
              <CardDescription>
                La propuesta no existe o no pertenece al proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/projects/${projectId}/analysis/change-sets`}>
                  Volver a propuestas
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const changeSet = changeSetData as unknown as ChangeSetRow;

  const { data: changesData, error: changesError } = await supabase
    .from("project_model_changes")
    .select(
      "id, category, operation, entity_key, label, before_value, after_value, decision, reviewer_comment, reviewed_at, impacted_artifact_types, display_order"
    )
    .eq("change_set_id", changeSetId)
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  if (changesError) throw new Error(changesError.message);

  const changes = (changesData ?? []) as unknown as ChangeRow[];
  const pendingCount = changes.filter(
    (change) => change.decision === "pending"
  ).length;
  const acceptedCount = changes.filter(
    (change) => change.decision === "accepted"
  ).length;
  const rejectedCount = changes.filter(
    (change) => change.decision === "rejected"
  ).length;
  const isClosed = ["applied", "rejected", "cancelled"].includes(
    changeSet.status
  );
  const canApply =
    canManage &&
    !isClosed &&
    pendingCount === 0 &&
    acceptedCount > 0;
  const canClose =
    canManage &&
    !isClosed &&
    pendingCount === 0 &&
    acceptedCount === 0 &&
    rejectedCount > 0;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/analysis/change-sets`}>
              ← Volver a propuestas
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/analysis`}>
              Ver Project Model
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/agents`}>
              Ver agentes
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge>{getStatusLabel(changeSet.status)}</Badge>
            <Badge variant="outline">
              {changeSet.source_type === "manual"
                ? "Edición manual"
                : "Propuesta de IA"}
            </Badge>
            <Badge variant="secondary">
              {changes.length} cambios
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {changeSet.title}
          </h1>
          <p className="mt-2 font-medium">{project.name}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Creada el {formatDate(changeSet.created_at)}. Revisa cada
            modificación antes de aplicar la propuesta.
          </p>
        </header>

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo completar la operación
              </CardTitle>
              <CardDescription>{actionError}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {reviewed ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Decisión guardada</CardTitle>
              <CardDescription>
                El cambio individual fue actualizado.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {applied ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Propuesta aplicada</CardTitle>
              <CardDescription>
                El Project Model fue versionado y solo se
                regeneraron los documentos afectados.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {closed ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Propuesta cerrada</CardTitle>
              <CardDescription>
                Todos los cambios fueron rechazados y no se
                modificó el Project Model.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Estado de revisión</CardTitle>
            <CardDescription>
              La aplicación permanece bloqueada hasta revisar
              todos los cambios.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aceptados</p>
              <p className="text-2xl font-semibold">{acceptedCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rechazados</p>
              <p className="text-2xl font-semibold">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>

        {!canManage ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Acceso de consulta</CardTitle>
              <CardDescription>
                Solo owner y admin pueden revisar o aplicar cambios.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-6">
          {changes.map((change, index) => (
            <Card key={change.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {index + 1}. {getCategoryLabel(change.category)}
                  </Badge>
                  <Badge variant="secondary">
                    {getOperationLabel(change.operation)}
                  </Badge>
                  <Badge
                    variant={
                      change.decision === "rejected"
                        ? "destructive"
                        : change.decision === "accepted"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {getDecisionLabel(change.decision)}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-xl">
                  {change.label}
                </CardTitle>
                <CardDescription>
                  Documentos afectados: {change.impacted_artifact_types.join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium">Valor vigente</p>
                    {valuePreview(change.before_value)}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Valor propuesto</p>
                    {valuePreview(change.after_value)}
                  </div>
                </div>

                {change.reviewer_comment ? (
                  <p className="rounded-md bg-muted/40 p-3 text-sm">
                    {change.reviewer_comment}
                  </p>
                ) : null}

                <Separator />

                <ChangeReviewControls
                  projectId={projectId}
                  changeSetId={changeSetId}
                  changeId={change.id}
                  decision={change.decision}
                  reviewerComment={change.reviewer_comment}
                  disabled={!canManage || isClosed}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-5">
          {canApply ? (
            <ApplyChangeSetForm
              projectId={projectId}
              changeSetId={changeSetId}
            />
          ) : null}

          {canClose ? (
            <CloseChangeSetForm
              projectId={projectId}
              changeSetId={changeSetId}
            />
          ) : null}

          {!isClosed && pendingCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Revisa los {pendingCount} cambios pendientes para
              habilitar la decisión final.
            </p>
          ) : null}
        </div>

        {Object.keys(changeSet.application_summary ?? {}).length > 0 ? (
          <details className="mt-8 rounded-lg border">
            <summary className="cursor-pointer px-5 py-4 font-medium">
              Ver auditoría de aplicación
            </summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t p-5 text-xs leading-6">
              {JSON.stringify(changeSet.application_summary, null, 2)}
            </pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}
