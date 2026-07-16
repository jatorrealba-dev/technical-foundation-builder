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
import { canManageAgentReviews } from "@/domain/organizations/membership";
import {
  getReadinessDimensionLabel,
  getReadinessLevelLabel,
  type ReadinessActionStatus,
  type ReadinessAssessmentSource,
  type ReadinessBlockerStatus,
  type ReadinessDimension,
  type ReadinessLevel,
  type ReadinessPriority,
} from "@/domain/readiness/readiness";
import { createClient } from "@/lib/supabase/server";

import {
  importReadinessAgentRunFormAction,
  runDeterministicReadinessAssessmentFormAction,
} from "./actions";
import {
  ImportReadinessAgentButton,
  RunDeterministicReadinessButton,
} from "./readiness-action-buttons";
import {
  ReadinessActionReviewControls,
  ReadinessBlockerReviewControls,
} from "./readiness-review-controls";

type ReadinessPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    assessed?: string | string[];
    imported?: string | string[];
    updated?: string | string[];
    assessment?: string | string[];
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

type AssessmentRow = {
  id: string;
  source: ReadinessAssessmentSource;
  source_run_id: string | null;
  project_model_version_number: number | null;
  overall_score: number;
  level: ReadinessLevel;
  summary: string;
  confidence: number | null;
  blocker_count: number;
  critical_blocker_count: number;
  high_blocker_count: number;
  medium_blocker_count: number;
  low_blocker_count: number;
  created_at: string;
};

type DimensionRow = {
  assessment_id: string;
  dimension_key: ReadinessDimension;
  score: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
};

type BlockerRow = {
  id: string;
  assessment_id: string;
  dimension_key: ReadinessDimension;
  title: string;
  reason: string;
  priority: ReadinessPriority;
  evidence: string[];
  status: ReadinessBlockerStatus;
  review_comment: string | null;
  reviewed_at: string | null;
};

type ActionRow = {
  id: string;
  assessment_id: string;
  dimension_key: ReadinessDimension;
  action: string;
  owner_role: string;
  expected_outcome: string;
  priority: Exclude<ReadinessPriority, "critical">;
  status: ReadinessActionStatus;
  review_comment: string | null;
  reviewed_at: string | null;
};

type AgentRunRow = {
  id: string;
  created_at: string;
};

type AgentReviewRow = {
  run_id: string;
  decision: string;
};

type ImportedAssessmentRow = {
  source_run_id: string | null;
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive";

function firstSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getLevelVariant(level: ReadinessLevel): BadgeVariant {
  switch (level) {
    case "ready":
      return "default";
    case "ready_for_review":
    case "progressing":
      return "secondary";
    case "at_risk":
    case "not_ready":
      return "destructive";
  }
}

function getPriorityVariant(
  priority: ReadinessPriority
): BadgeVariant {
  if (priority === "critical" || priority === "high") {
    return "destructive";
  }

  if (priority === "medium") {
    return "secondary";
  }

  return "outline";
}

function getBlockerStatusLabel(
  status: ReadinessBlockerStatus
): string {
  switch (status) {
    case "accepted":
      return "Aceptado";
    case "resolved":
      return "Resuelto";
    case "dismissed":
      return "Descartado";
    case "open":
      return "Abierto";
  }
}

function getActionStatusLabel(
  status: ReadinessActionStatus
): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "in_progress":
      return "En progreso";
    case "completed":
      return "Completada";
    case "dismissed":
      return "Descartada";
  }
}

function getStatusVariant(
  status: ReadinessBlockerStatus | ReadinessActionStatus
): BadgeVariant {
  if (status === "resolved" || status === "completed") {
    return "default";
  }

  if (status === "accepted" || status === "in_progress") {
    return "secondary";
  }

  if (status === "dismissed") {
    return "outline";
  }

  return "destructive";
}

export default async function ReadinessPage({
  params,
  searchParams,
}: ReadinessPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const error = firstSearchParam(resolvedSearchParams.error);
  const assessed =
    firstSearchParam(resolvedSearchParams.assessed) === "1";
  const imported =
    firstSearchParam(resolvedSearchParams.imported) === "1";
  const updated =
    firstSearchParam(resolvedSearchParams.updated) === "1";
  const highlightedAssessmentId = firstSearchParam(
    resolvedSearchParams.assessment
  );

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: projectData, error: projectError } =
    await supabase
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
              <CardTitle>Proyecto no encontrado</CardTitle>
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

  const project = projectData as unknown as ProjectRow;

  const [membershipResult, modelResult, assessmentsResult] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", project.organization_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("project_models")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("readiness_assessments")
        .select(
          "id, source, source_run_id, project_model_version_number, overall_score, level, summary, confidence, blocker_count, critical_blocker_count, high_blocker_count, medium_blocker_count, low_blocker_count, created_at"
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  if (modelResult.error) {
    throw new Error(modelResult.error.message);
  }

  if (assessmentsResult.error) {
    throw new Error(assessmentsResult.error.message);
  }

  const role = membershipResult.data
    ? (membershipResult.data as unknown as MembershipRow).role
    : null;
  const canManage = canManageAgentReviews(role);
  const hasProjectModel = Boolean(modelResult.data);
  const assessments = (
    (assessmentsResult.data ?? []) as unknown as AssessmentRow[]
  );
  const latestAssessment = assessments[0] ?? null;

  let dimensions: DimensionRow[] = [];
  let blockers: BlockerRow[] = [];
  let actions: ActionRow[] = [];

  if (latestAssessment) {
    const [dimensionsResult, blockersResult, actionsResult] =
      await Promise.all([
        supabase
          .from("readiness_dimension_scores")
          .select(
            "assessment_id, dimension_key, score, rationale, evidence, gaps"
          )
          .eq("assessment_id", latestAssessment.id),
        supabase
          .from("readiness_blockers")
          .select(
            "id, assessment_id, dimension_key, title, reason, priority, evidence, status, review_comment, reviewed_at"
          )
          .eq("assessment_id", latestAssessment.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("readiness_actions")
          .select(
            "id, assessment_id, dimension_key, action, owner_role, expected_outcome, priority, status, review_comment, reviewed_at"
          )
          .eq("assessment_id", latestAssessment.id)
          .order("created_at", { ascending: true }),
      ]);

    if (dimensionsResult.error) {
      throw new Error(dimensionsResult.error.message);
    }

    if (blockersResult.error) {
      throw new Error(blockersResult.error.message);
    }

    if (actionsResult.error) {
      throw new Error(actionsResult.error.message);
    }

    dimensions = (
      (dimensionsResult.data ?? []) as unknown as DimensionRow[]
    ).sort((left, right) => left.dimension_key.localeCompare(right.dimension_key));
    blockers = (blockersResult.data ?? []) as unknown as BlockerRow[];
    actions = (actionsResult.data ?? []) as unknown as ActionRow[];
  }

  const { data: readinessRunRows, error: readinessRunsError } =
    await supabase
      .from("agent_runs")
      .select("id, created_at")
      .eq("project_id", projectId)
      .eq("agent_key", "readiness")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);

  if (readinessRunsError) {
    throw new Error(readinessRunsError.message);
  }

  const readinessRuns = (
    (readinessRunRows ?? []) as unknown as AgentRunRow[]
  );

  let importableRuns: AgentRunRow[] = [];

  if (readinessRuns.length > 0) {
    const runIds = readinessRuns.map((run) => run.id);
    const [reviewsResult, importedResult] = await Promise.all([
      supabase
        .from("agent_run_reviews")
        .select("run_id, decision")
        .in("run_id", runIds),
      supabase
        .from("readiness_assessments")
        .select("source_run_id")
        .in("source_run_id", runIds),
    ]);

    if (reviewsResult.error) {
      throw new Error(reviewsResult.error.message);
    }

    if (importedResult.error) {
      throw new Error(importedResult.error.message);
    }

    const approvedRunIds = new Set(
      (
        (reviewsResult.data ?? []) as unknown as AgentReviewRow[]
      )
        .filter((review) => review.decision === "approved")
        .map((review) => review.run_id)
    );
    const importedRunIds = new Set(
      (
        (importedResult.data ?? []) as unknown as ImportedAssessmentRow[]
      )
        .map((assessment) => assessment.source_run_id)
        .filter((runId): runId is string => Boolean(runId))
    );

    importableRuns = readinessRuns.filter(
      (run) =>
        approvedRunIds.has(run.id) &&
        !importedRunIds.has(run.id)
    );
  }

  const previousAssessment = assessments[1] ?? null;
  const scoreChange =
    latestAssessment && previousAssessment
      ? latestAssessment.overall_score -
        previousAssessment.overall_score
      : null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}`}>
              ← Volver al proyecto
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/consistency`}>
              Consistency Engine
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/agents`}>
              Agentes IA
            </Link>
          </Button>
        </div>

        <header className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Readiness Dashboard v7
              </Badge>
              {latestAssessment ? (
                <Badge variant={getLevelVariant(latestAssessment.level)}>
                  {getReadinessLevelLabel(latestAssessment.level)}
                </Badge>
              ) : (
                <Badge variant="outline">
                  Sin evaluación
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Preparación de implementación
            </h1>
            <p className="mt-2 font-medium">{project.name}</p>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Evalúa producto, dominio, arquitectura, datos,
              seguridad, testing, entrega y operación usando
              evidencia persistida. Los scores son indicadores
              revisables, no una autorización automática para
              iniciar producción.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <form action={runDeterministicReadinessAssessmentFormAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <RunDeterministicReadinessButton />
            </form>

            {!hasProjectModel ? (
              <p className="max-w-sm text-sm text-destructive">
                Debes generar el Project Model antes de evaluar readiness.
              </p>
            ) : null}
          </div>
        </header>

        {error ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle>Error de readiness</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {assessed ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Evaluación determinista guardada</CardTitle>
              <CardDescription>
                Se creó un snapshot inmutable con scores, bloqueadores y acciones.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {imported ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Evaluación de IA importada</CardTitle>
              <CardDescription>
                El resultado aprobado de Readiness Assessor quedó persistido y normalizado.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {updated ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>Seguimiento actualizado</CardTitle>
              <CardDescription>
                La transición quedó registrada en la auditoría de readiness.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {importableRuns.length > 0 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Readiness Assessor aprobado</CardTitle>
              <CardDescription>
                Importa una ejecución aprobada. Cada ejecución solo puede convertirse en una evaluación una vez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {importableRuns.map((run) => (
                <form
                  key={run.id}
                  action={importReadinessAgentRunFormAction}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="runId" value={run.id} />
                  <div>
                    <p className="font-medium">Ejecución aprobada</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(run.created_at)}
                    </p>
                  </div>
                  <ImportReadinessAgentButton />
                </form>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {!latestAssessment ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin evaluaciones</CardTitle>
              <CardDescription>
                Ejecuta primero la evaluación determinista. No consume créditos de OpenAI.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div
              className={`grid gap-6 lg:grid-cols-[0.8fr_1.2fr] ${
                highlightedAssessmentId === latestAssessment.id
                  ? "rounded-xl ring-2 ring-primary ring-offset-4"
                  : ""
              }`}
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getLevelVariant(latestAssessment.level)}>
                      {getReadinessLevelLabel(latestAssessment.level)}
                    </Badge>
                    <Badge variant="outline">
                      {latestAssessment.source === "agent"
                        ? "Readiness Assessor"
                        : "Determinista"}
                    </Badge>
                    {latestAssessment.project_model_version_number ? (
                      <Badge variant="outline">
                        Model v{latestAssessment.project_model_version_number}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-5xl">
                    {latestAssessment.overall_score}
                    <span className="text-xl text-muted-foreground">/100</span>
                  </CardTitle>
                  <CardDescription>
                    {latestAssessment.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Progress value={latestAssessment.overall_score} />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Cambio</p>
                      <p className="text-xl font-semibold">
                        {scoreChange === null
                          ? "—"
                          : `${scoreChange > 0 ? "+" : ""}${scoreChange}`}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Bloqueadores</p>
                      <p className="text-xl font-semibold">
                        {latestAssessment.blocker_count}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Críticos</p>
                      <p className="text-xl font-semibold">
                        {latestAssessment.critical_blocker_count}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Altos</p>
                      <p className="text-xl font-semibold">
                        {latestAssessment.high_blocker_count}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>{formatDate(latestAssessment.created_at)}</p>
                    {latestAssessment.confidence !== null ? (
                      <p>
                        Confianza del agente: {Math.round(latestAssessment.confidence * 100)}%
                      </p>
                    ) : null}
                  </div>

                  <Button variant="outline" asChild>
                    <Link
                      href={`/projects/${projectId}/readiness/assessments/${latestAssessment.id}`}
                    >
                      Abrir snapshot completo
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score por dimensión</CardTitle>
                  <CardDescription>
                    Cada dimensión conserva evidencia y brechas del momento de la evaluación.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {dimensions.map((dimension) => (
                    <div key={dimension.dimension_key} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {getReadinessDimensionLabel(dimension.dimension_key)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {dimension.rationale}
                          </p>
                        </div>
                        <Badge
                          variant={
                            dimension.score >= 75
                              ? "default"
                              : dimension.score >= 50
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {dimension.score}
                        </Badge>
                      </div>
                      <Progress value={dimension.score} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Separator className="my-8" />

            <div className="grid gap-8 xl:grid-cols-2">
              <section>
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Bloqueadores
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Riesgos o vacíos que limitan el score. Su estado no altera retroactivamente el snapshot.
                  </p>
                </div>

                <div className="space-y-4">
                  {blockers.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-sm text-muted-foreground">
                        Esta evaluación no registró bloqueadores.
                      </CardContent>
                    </Card>
                  ) : null}

                  {blockers.map((blocker) => (
                    <Card key={blocker.id}>
                      <CardHeader>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getPriorityVariant(blocker.priority)}>
                            {blocker.priority}
                          </Badge>
                          <Badge variant="outline">
                            {getReadinessDimensionLabel(blocker.dimension_key)}
                          </Badge>
                          <Badge variant={getStatusVariant(blocker.status)}>
                            {getBlockerStatusLabel(blocker.status)}
                          </Badge>
                        </div>
                        <CardTitle>{blocker.title}</CardTitle>
                        <CardDescription>{blocker.reason}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {blocker.evidence.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {blocker.evidence.map((evidence) => (
                              <li key={evidence}>{evidence}</li>
                            ))}
                          </ul>
                        ) : null}

                        {canManage ? (
                          <ReadinessBlockerReviewControls
                            projectId={projectId}
                            blockerId={blocker.id}
                            status={blocker.status}
                            comment={blocker.review_comment}
                          />
                        ) : blocker.review_comment ? (
                          <p className="rounded-lg border p-3 text-sm">
                            {blocker.review_comment}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Próximas acciones
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Recomendaciones accionables con responsable sugerido y resultado esperado.
                  </p>
                </div>

                <div className="space-y-4">
                  {actions.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-sm text-muted-foreground">
                        Esta evaluación no registró acciones.
                      </CardContent>
                    </Card>
                  ) : null}

                  {actions.map((action) => (
                    <Card key={action.id}>
                      <CardHeader>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getPriorityVariant(action.priority)}>
                            {action.priority}
                          </Badge>
                          <Badge variant="outline">
                            {getReadinessDimensionLabel(action.dimension_key)}
                          </Badge>
                          <Badge variant={getStatusVariant(action.status)}>
                            {getActionStatusLabel(action.status)}
                          </Badge>
                        </div>
                        <CardTitle>{action.action}</CardTitle>
                        <CardDescription>
                          Responsable sugerido: {action.owner_role}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium">Resultado esperado</p>
                          <p className="text-sm text-muted-foreground">
                            {action.expected_outcome}
                          </p>
                        </div>

                        {canManage ? (
                          <ReadinessActionReviewControls
                            projectId={projectId}
                            actionId={action.id}
                            status={action.status}
                            comment={action.review_comment}
                          />
                        ) : action.review_comment ? (
                          <p className="rounded-lg border p-3 text-sm">
                            {action.review_comment}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </div>

            <Separator className="my-8" />

            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Tendencia histórica
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cada evaluación es inmutable y puede compararse con el Project Model vigente en ese momento.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assessments.map((assessment) => (
                  <Card key={assessment.id}>
                    <CardHeader>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getLevelVariant(assessment.level)}>
                          {assessment.overall_score}/100
                        </Badge>
                        <Badge variant="outline">
                          {assessment.source === "agent" ? "IA" : "Determinista"}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">
                        {getReadinessLevelLabel(assessment.level)}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(assessment.created_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Progress value={assessment.overall_score} />
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {assessment.summary}
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/projects/${projectId}/readiness/assessments/${assessment.id}`}
                        >
                          Ver evaluación
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
