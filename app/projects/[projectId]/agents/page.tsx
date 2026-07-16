import Link from "next/link";
import { redirect } from "next/navigation";

import {
  agentCatalog,
  getAgentDefinition,
} from "@/agents/registry";
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
import type {
  AgentApplicationStatus,
  AgentKey,
  AgentReviewDecision,
  AgentRunStatus,
} from "@/domain/agents/agent";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import type { ProjectModel } from "@/domain/project-model/project-model";
import { getAiConfigurationStatus } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";
import { projectModelAgentOutputSchema } from "@/schemas/agents/agent-outputs";
import { compareProjectModels } from "@/services/project-model/compare-project-models";
import { normalizeAgentProjectModel } from "@/services/project-model/normalize-agent-project-model";

import { runProjectAgentFormAction } from "./actions";
import { AgentRunReviewControls } from "./review-controls";

type ProjectAgentsPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    run?: string | string[];
    reviewed?: string | string[];
    applied?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  organization_id: string;
};

type MembershipRow = {
  role: string;
};

type ProjectModelRow = {
  project_id: string;
  status: ProjectModel["status"];
  requirements: ProjectModel["requirements"];
  assumptions: ProjectModel["assumptions"];
  domain_entities: ProjectModel["domainEntities"];
  risks: ProjectModel["risks"];
  open_questions: ProjectModel["openQuestions"];
  generated_at: string;
  updated_at: string;
};

type AgentRunRow = {
  id: string;
  agent_key: AgentKey;
  status: AgentRunStatus;
  provider: string;
  model: string;
  prompt_version: string;
  output: unknown;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  correlation_id: string;
  failure_code: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type AgentRunReviewRow = {
  id: string;
  run_id: string;
  project_id: string;
  decision: AgentReviewDecision;
  reviewer_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  application_status: AgentApplicationStatus;
  application_summary: Record<string, unknown>;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentChangeSetRow = {
  id: string;
  source_run_id: string | null;
};

type OrganizationAiPolicyRow = {
  ai_enabled: boolean;
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive";

function mapProjectModel(
  row: ProjectModelRow
): ProjectModel {
  return {
    projectId: row.project_id,
    status: row.status,
    requirements: row.requirements,
    assumptions: row.assumptions,
    domainEntities: row.domain_entities,
    risks: row.risks,
    openQuestions: row.open_questions,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLatency(
  value: number | null
): string {
  if (value === null) {
    return "No disponible";
  }

  if (value < 1_000) {
    return `${value} ms`;
  }

  return `${(value / 1_000).toFixed(1)} s`;
}

function getStatusLabel(
  status: AgentRunStatus
): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "running":
      return "Ejecutando";
    case "completed":
      return "Completado";
    case "failed":
      return "Fallido";
    case "cancelled":
      return "Cancelado";
  }
}

function getStatusVariant(
  status: AgentRunStatus
): BadgeVariant {
  switch (status) {
    case "completed":
      return "default";
    case "running":
    case "queued":
      return "secondary";
    case "failed":
      return "destructive";
    case "cancelled":
      return "outline";
  }
}

function getReviewLabel(
  decision: AgentReviewDecision
): string {
  switch (decision) {
    case "pending":
      return "Pendiente de revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
  }
}

function getReviewVariant(
  decision: AgentReviewDecision
): BadgeVariant {
  switch (decision) {
    case "pending":
      return "secondary";
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
  }
}

function getApplicationLabel(
  status: AgentApplicationStatus
): string {
  switch (status) {
    case "not_applied":
      return "Sin aplicar";
    case "applying":
      return "Aplicando";
    case "applied":
      return "Aplicado";
    case "failed":
      return "Aplicación fallida";
    case "not_applicable":
      return "Aplicación no disponible";
  }
}

function getApplicationVariant(
  status: AgentApplicationStatus
): BadgeVariant {
  switch (status) {
    case "applied":
      return "default";
    case "failed":
      return "destructive";
    case "applying":
    case "not_applied":
      return "secondary";
    case "not_applicable":
      return "outline";
  }
}

export default async function ProjectAgentsPage({
  params,
  searchParams,
}: ProjectAgentsPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const actionError = firstSearchParam(
    resolvedSearchParams.error
  );

  const completedRunId = firstSearchParam(
    resolvedSearchParams.run
  );

  const reviewedDecision = firstSearchParam(
    resolvedSearchParams.reviewed
  );

  const appliedRunId = firstSearchParam(
    resolvedSearchParams.applied
  );

  const highlightedRunId =
    appliedRunId ?? completedRunId;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const {
    data: projectData,
    error: projectError,
  } = await supabase
    .from("projects")
    .select("id, name, organization_id")
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

  const {
    data: modelData,
    error: modelError,
  } = await supabase
    .from("project_models")
    .select(
      "project_id, status, requirements, assumptions, domain_entities, risks, open_questions, generated_at, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (modelError) {
    throw new Error(modelError.message);
  }

  const currentProjectModel = modelData
    ? mapProjectModel(
        modelData as unknown as ProjectModelRow
      )
    : null;

  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipRole = membershipData
    ? (membershipData as unknown as MembershipRow).role
    : null;

  const canManageReviews =
    canManageAgentReviews(membershipRole);

  const { data: aiPolicyData, error: aiPolicyError } =
    await supabase
      .from("organization_ai_policies")
      .select("ai_enabled")
      .eq("organization_id", project.organization_id)
      .maybeSingle();

  if (aiPolicyError) {
    throw new Error(aiPolicyError.message);
  }

  const organizationAiEnabled = aiPolicyData
    ? (aiPolicyData as unknown as OrganizationAiPolicyRow).ai_enabled
    : true;

  const {
    count: artifactCount,
    error: artifactError,
  } = await supabase
    .from("artifacts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("project_id", projectId);

  if (artifactError) {
    throw new Error(artifactError.message);
  }

  const {
    data: runRows,
    error: runsError,
  } = await supabase
    .from("agent_runs")
    .select(
      "id, agent_key, status, provider, model, prompt_version, output, error_message, input_tokens, output_tokens, total_tokens, latency_ms, correlation_id, failure_code, started_at, completed_at, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  const runsAvailable = !runsError;

  const runs = runsAvailable
    ? (runRows ?? []) as unknown as AgentRunRow[]
    : [];

  let reviewsAvailable = true;
  let reviewsErrorMessage: string | null = null;
  let reviews: AgentRunReviewRow[] = [];

  if (runs.length > 0) {
    const {
      data: reviewRows,
      error: reviewsError,
    } = await supabase
      .from("agent_run_reviews")
      .select(
        "id, run_id, project_id, decision, reviewer_comment, reviewed_by, reviewed_at, application_status, application_summary, applied_by, applied_at, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .in(
        "run_id",
        runs.map((run) => run.id)
      );

    reviewsAvailable = !reviewsError;
    reviewsErrorMessage =
      reviewsError?.message ?? null;

    reviews = reviewsAvailable
      ? (reviewRows ?? []) as unknown as AgentRunReviewRow[]
      : [];
  }

  const reviewByRunId = new Map(
    reviews.map((review) => [
      review.run_id,
      review,
    ])
  );

  const projectModelRunIds = runs
    .filter((run) => run.agent_key === "project_model")
    .map((run) => run.id);

  let changeSets: AgentChangeSetRow[] = [];

  if (projectModelRunIds.length > 0) {
    const { data: changeSetRows, error: changeSetsError } =
      await supabase
        .from("project_model_change_sets")
        .select("id, source_run_id")
        .eq("project_id", projectId)
        .in("source_run_id", projectModelRunIds);

    if (!changeSetsError) {
      changeSets = (changeSetRows ?? []) as unknown as AgentChangeSetRow[];
    }
  }

  const changeSetByRunId = new Map(
    changeSets
      .filter((changeSet) => changeSet.source_run_id !== null)
      .map((changeSet) => [
        changeSet.source_run_id as string,
        changeSet.id,
      ])
  );

  const configuration =
    getAiConfigurationStatus();

  const hasProjectModel = currentProjectModel !== null;
  const hasArtifacts = (artifactCount ?? 0) > 0;

  const pendingReviewCount = reviews.filter(
    (review) => review.decision === "pending"
  ).length;

  const approvedReviewCount = reviews.filter(
    (review) => review.decision === "approved"
  ).length;

  const appliedReviewCount = reviews.filter(
    (review) =>
      review.application_status === "applied"
  ).length;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>
              ← Volver al proyecto
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link
              href={`/projects/${project.id}/documents`}
            >
              Ver documentos
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/consistency`}>
              Consistency Engine
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/organizations/${project.organization_id}/settings/ai`}>
              Operación de IA
            </Link>
          </Button>

          {hasProjectModel ? (
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${project.id}/analysis/history`}
              >
                Historial del Project Model
              </Link>
            </Button>
          ) : null}

          {hasProjectModel ? (
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${project.id}/analysis/change-sets`}
              >
                Propuestas de cambios
              </Link>
            </Button>
          ) : null}
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              AI Agent Foundation
            </Badge>

            <Badge
              variant={
                configuration.ready
                  ? "default"
                  : "outline"
              }
            >
              {configuration.ready
                ? "Configuración lista"
                : "Configuración pendiente"}
            </Badge>

            <Badge variant={organizationAiEnabled ? "default" : "destructive"}>
              {organizationAiEnabled
                ? "Política habilitada"
                : "Política bloqueada"}
            </Badge>

            {reviewsAvailable ? (
              <Badge variant="outline">
                {pendingReviewCount} pendientes de revisión
              </Badge>
            ) : null}
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Agentes de IA
          </h1>

          <p className="mt-2 font-medium">
            {project.name}
          </p>

          <p className="mt-3 max-w-3xl text-muted-foreground">
            Ejecuta especialistas con salidas estructuradas,
            prompts versionados y trazabilidad persistida en
            Supabase. Los resultados requieren revisión humana
            antes de producir cualquier cambio en el proyecto.
          </p>
        </header>

        {completedRunId ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                Ejecución completada
              </CardTitle>

              <CardDescription>
                La salida estructurada fue validada y quedó
                pendiente de revisión humana.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {reviewedDecision ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                Revisión guardada
              </CardTitle>

              <CardDescription>
                La ejecución fue {reviewedDecision === "approved"
                  ? "aprobada"
                  : "rechazada"} y la decisión quedó auditada.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {appliedRunId ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                Recomendaciones aplicadas
              </CardTitle>

              <CardDescription>
                El Project Model fue actualizado y los ocho
                documentos se regeneraron conservando sus
                versiones anteriores.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!runsAvailable ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                Migración de agentes pendiente
              </CardTitle>

              <CardDescription>
                Aplica 0006_ai_agent_foundation.sql antes de
                ejecutar agentes. Detalle: {runsError?.message}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {runsAvailable && !reviewsAvailable ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                Migración de revisión pendiente
              </CardTitle>

              <CardDescription>
                Aplica 0007_agent_run_human_review.sql para
                aprobar, rechazar y aplicar resultados. Detalle:{" "}
                {reviewsErrorMessage}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo completar la operación
              </CardTitle>

              <CardDescription>
                {actionError}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              Configuración del runtime
            </CardTitle>

            <CardDescription>
              El servidor valida estas variables sin exponer
              secretos al navegador.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="font-medium">
                Agentes habilitados
              </p>
              <p className="text-muted-foreground">
                {configuration.enabled ? "Sí" : "No"}
              </p>
            </div>

            <div>
              <p className="font-medium">
                API key
              </p>
              <p className="text-muted-foreground">
                {configuration.hasApiKey
                  ? "Configurada"
                  : "Pendiente"}
              </p>
            </div>

            <div>
              <p className="font-medium">
                Modelo
              </p>
              <p className="text-muted-foreground">
                {configuration.model ?? "Pendiente"}
              </p>
            </div>

            <div>
              <p className="font-medium">
                Trazas OpenAI
              </p>
              <p className="text-muted-foreground">
                {configuration.tracingEnabled
                  ? "Habilitadas"
                  : "Deshabilitadas"}
              </p>
            </div>

            <div>
              <p className="font-medium">Máximo de turnos</p>
              <p className="text-muted-foreground">
                {configuration.maxTurns}
              </p>
            </div>
          </CardContent>
        </Card>

        {reviewsAvailable ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>
                Gobernanza de resultados
              </CardTitle>

              <CardDescription>
                La ejecución técnica y la decisión humana se
                registran como estados independientes.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="font-medium">
                  Pendientes
                </p>
                <p className="text-2xl font-semibold">
                  {pendingReviewCount}
                </p>
              </div>

              <div>
                <p className="font-medium">
                  Aprobadas
                </p>
                <p className="text-2xl font-semibold">
                  {approvedReviewCount}
                </p>
              </div>

              <div>
                <p className="font-medium">
                  Aplicadas
                </p>
                <p className="text-2xl font-semibold">
                  {appliedReviewCount}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-5">
          <h2 className="text-2xl font-semibold tracking-tight">
            Especialistas disponibles
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Cada ejecución recibe un snapshot inmutable del
            proyecto y guarda modelo, prompt, tokens, latencia,
            resultado o error.
          </p>
        </div>

        <div className="mb-10 grid gap-5 lg:grid-cols-2">
          {agentCatalog.map((definition) => {
            const missingModel =
              definition.requiresProjectModel &&
              !hasProjectModel;

            const missingArtifacts =
              definition.requiresArtifacts &&
              !hasArtifacts;

            const canRun =
              configuration.ready &&
              organizationAiEnabled &&
              runsAvailable &&
              !missingModel &&
              !missingArtifacts;

            return (
              <Card key={definition.key}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {definition.key}
                    </Badge>

                    <Badge variant="secondary">
                      {definition.promptVersion}
                    </Badge>
                  </div>

                  <CardTitle className="mt-3">
                    {definition.name}
                  </CardTitle>

                  <CardDescription>
                    {definition.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Project Model: {definition.requiresProjectModel
                        ? "requerido"
                        : "opcional"}
                    </p>
                    <p>
                      Documentos: {definition.requiresArtifacts
                        ? "requeridos"
                        : "opcionales"}
                    </p>
                  </div>

                  {missingModel ? (
                    <p className="text-sm text-destructive">
                      Primero genera el análisis del proyecto.
                    </p>
                  ) : null}

                  {missingArtifacts ? (
                    <p className="text-sm text-destructive">
                      Primero genera al menos un documento.
                    </p>
                  ) : null}

                  {!organizationAiEnabled ? (
                    <p className="text-sm text-destructive">
                      La política de la organización bloquea nuevas ejecuciones.
                    </p>
                  ) : null}

                  <form action={runProjectAgentFormAction}>
                    <input
                      type="hidden"
                      name="projectId"
                      value={project.id}
                    />

                    <input
                      type="hidden"
                      name="agentKey"
                      value={definition.key}
                    />

                    <Button
                      type="submit"
                      disabled={!canRun}
                    >
                      Ejecutar agente
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator className="mb-10" />

        <div className="mb-5">
          <h2 className="text-2xl font-semibold tracking-tight">
            Historial y revisión
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Se muestran las veinte ejecuciones más recientes.
            Cada salida completada debe aprobarse o rechazarse.
          </p>
        </div>

        {runs.length > 0 ? (
          <div className="grid gap-5">
            {runs.map((agentRun) => {
              const definition = getAgentDefinition(
                agentRun.agent_key
              );

              const review = reviewByRunId.get(
                agentRun.id
              );

              const isHighlighted =
                highlightedRunId === agentRun.id;

              const parsedProjectModelOutput =
                agentRun.agent_key === "project_model" &&
                agentRun.output
                  ? projectModelAgentOutputSchema.safeParse(
                      agentRun.output
                    )
                  : null;

              const proposedProjectModel =
                currentProjectModel &&
                parsedProjectModelOutput?.success
                  ? normalizeAgentProjectModel({
                      projectId,
                      output:
                        parsedProjectModelOutput.data,
                      generatedAt:
                        currentProjectModel.generatedAt,
                      updatedAt:
                        agentRun.completed_at ??
                        agentRun.created_at,
                    })
                  : null;

              const projectModelDiff =
                currentProjectModel &&
                proposedProjectModel
                  ? compareProjectModels(
                      currentProjectModel,
                      proposedProjectModel
                    )
                  : null;

              return (
                <Card
                  key={agentRun.id}
                  className={
                    isHighlighted
                      ? "border-green-600"
                      : undefined
                  }
                >
                  <CardHeader>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={getStatusVariant(
                              agentRun.status
                            )}
                          >
                            {getStatusLabel(
                              agentRun.status
                            )}
                          </Badge>

                          <Badge variant="outline">
                            {definition.name}
                          </Badge>

                          <Badge variant="secondary">
                            {agentRun.prompt_version}
                          </Badge>

                          {review ? (
                            <Badge
                              variant={getReviewVariant(
                                review.decision
                              )}
                            >
                              {getReviewLabel(
                                review.decision
                              )}
                            </Badge>
                          ) : null}

                          {review ? (
                            <Badge
                              variant={getApplicationVariant(
                                review.application_status
                              )}
                            >
                              {getApplicationLabel(
                                review.application_status
                              )}
                            </Badge>
                          ) : null}
                        </div>

                        <CardTitle className="text-xl">
                          {agentRun.model}
                        </CardTitle>

                        <CardDescription className="mt-2">
                          Ejecutado el {formatDate(
                            agentRun.created_at
                          )}
                        </CardDescription>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <p>
                          Tokens: {agentRun.total_tokens ?? "—"}
                        </p>
                        <p>
                          Latencia: {formatLatency(
                            agentRun.latency_ms
                          )}
                        </p>
                        <p className="font-mono text-xs">
                          Correlación: {agentRun.correlation_id}
                        </p>
                        {agentRun.failure_code ? (
                          <p>Código: {agentRun.failure_code}</p>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {agentRun.error_message ? (
                      <p className="text-sm text-destructive">
                        {agentRun.error_message}
                      </p>
                    ) : null}

                    {agentRun.output ? (
                      <details className="rounded-lg border bg-muted/20">
                        <summary className="cursor-pointer px-5 py-4 font-medium">
                          Ver salida estructurada
                        </summary>

                        <div className="border-t p-5">
                          <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap text-sm leading-7">
                            {JSON.stringify(
                              agentRun.output,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </details>
                    ) : null}

                    {review ? (
                      <div className="space-y-4 rounded-lg border bg-muted/10 p-5">
                        <div>
                          <h3 className="font-semibold">
                            Revisión humana
                          </h3>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Decisión: {getReviewLabel(
                              review.decision
                            )}
                            {review.reviewed_at
                              ? ` · ${formatDate(review.reviewed_at)}`
                              : ""}
                          </p>
                        </div>

                        {review.reviewer_comment ? (
                          <p className="rounded-md bg-muted/40 p-3 text-sm">
                            {review.reviewer_comment}
                          </p>
                        ) : null}

                        {Object.keys(
                          review.application_summary ?? {}
                        ).length > 0 ? (
                          <details className="rounded-lg border bg-background">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                              Ver auditoría de aplicación
                            </summary>

                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t p-4 text-xs leading-6">
                              {JSON.stringify(
                                review.application_summary,
                                null,
                                2
                              )}
                            </pre>
                          </details>
                        ) : null}

                        {projectModelDiff ? (
                          <details className="rounded-lg border bg-background">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                              Revisar impacto propuesto · {projectModelDiff.totalChanges} cambios
                            </summary>

                            <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                              {[
                                {
                                  label: "Requisitos",
                                  diff: projectModelDiff.requirements,
                                },
                                {
                                  label: "Supuestos",
                                  diff: projectModelDiff.assumptions,
                                },
                                {
                                  label: "Entidades",
                                  diff: projectModelDiff.domainEntities,
                                },
                                {
                                  label: "Riesgos",
                                  diff: projectModelDiff.risks,
                                },
                                {
                                  label: "Preguntas",
                                  diff: projectModelDiff.openQuestions,
                                },
                              ].map((section) => (
                                <div
                                  key={section.label}
                                  className="rounded-md border p-3"
                                >
                                  <p className="font-medium">
                                    {section.label}
                                  </p>
                                  <p className="mt-1 text-muted-foreground">
                                    +{section.diff.added} · ~{section.diff.modified} · -{section.diff.removed}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        <AgentRunReviewControls
                          projectId={project.id}
                          runId={agentRun.id}
                          agentKey={agentRun.agent_key}
                          decision={review.decision}
                          reviewerComment={
                            review.reviewer_comment
                          }
                          applicationStatus={
                            review.application_status
                          }
                          canManage={canManageReviews}
                          changeSetId={
                            changeSetByRunId.get(agentRun.id) ?? null
                          }
                        />
                      </div>
                    ) : agentRun.status === "completed" &&
                      agentRun.output ? (
                      <p className="text-sm text-destructive">
                        Esta ejecución no tiene registro de
                        revisión. Aplica la migración 0007 para
                        crear el backfill correspondiente.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                Sin ejecuciones todavía
              </CardTitle>

              <CardDescription>
                Configura el runtime y ejecuta un especialista
                para crear el primer registro auditable.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </main>
  );
}
