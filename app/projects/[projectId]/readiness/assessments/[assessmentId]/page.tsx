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

type AssessmentDetailPageProps = {
  params: Promise<{
    projectId: string;
    assessmentId: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
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
  evidence_snapshot: Record<string, unknown>;
  blocker_count: number;
  critical_blocker_count: number;
  high_blocker_count: number;
  medium_blocker_count: number;
  low_blocker_count: number;
  created_at: string;
};

type DimensionRow = {
  dimension_key: ReadinessDimension;
  score: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
};

type BlockerRow = {
  id: string;
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
  dimension_key: ReadinessDimension;
  action: string;
  owner_role: string;
  expected_outcome: string;
  priority: Exclude<ReadinessPriority, "critical">;
  status: ReadinessActionStatus;
  review_comment: string | null;
  reviewed_at: string | null;
};

type EventRow = {
  id: string;
  item_type: "blocker" | "action";
  item_id: string;
  status_from: string | null;
  status_to: string;
  comment: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getLevelVariant(
  level: ReadinessLevel
): "default" | "secondary" | "destructive" | "outline" {
  if (level === "ready") {
    return "default";
  }

  if (level === "ready_for_review" || level === "progressing") {
    return "secondary";
  }

  return "destructive";
}

function getPriorityVariant(
  priority: ReadinessPriority
): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical" || priority === "high") {
    return "destructive";
  }

  if (priority === "medium") {
    return "secondary";
  }

  return "outline";
}

export default async function AssessmentDetailPage({
  params,
}: AssessmentDetailPageProps) {
  const { projectId, assessmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [projectResult, assessmentResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("readiness_assessments")
      .select(
        "id, source, source_run_id, project_model_version_number, overall_score, level, summary, confidence, evidence_snapshot, blocker_count, critical_blocker_count, high_blocker_count, medium_blocker_count, low_blocker_count, created_at"
      )
      .eq("id", assessmentId)
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (projectResult.error) {
    throw new Error(projectResult.error.message);
  }

  if (assessmentResult.error) {
    throw new Error(assessmentResult.error.message);
  }

  if (!projectResult.data || !assessmentResult.data) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Evaluación no encontrada</CardTitle>
              <CardDescription>
                El snapshot no existe o no tienes acceso al proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/projects/${projectId}/readiness`}>
                  Volver a readiness
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const project = projectResult.data as unknown as ProjectRow;
  const assessment = assessmentResult.data as unknown as AssessmentRow;

  const [dimensionsResult, blockersResult, actionsResult, eventsResult] =
    await Promise.all([
      supabase
        .from("readiness_dimension_scores")
        .select("dimension_key, score, rationale, evidence, gaps")
        .eq("assessment_id", assessmentId),
      supabase
        .from("readiness_blockers")
        .select(
          "id, dimension_key, title, reason, priority, evidence, status, review_comment, reviewed_at"
        )
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("readiness_actions")
        .select(
          "id, dimension_key, action, owner_role, expected_outcome, priority, status, review_comment, reviewed_at"
        )
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("readiness_review_events")
        .select(
          "id, item_type, item_id, status_from, status_to, comment, created_at"
        )
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: false }),
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

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const dimensions = (
    (dimensionsResult.data ?? []) as unknown as DimensionRow[]
  ).sort((left, right) => left.dimension_key.localeCompare(right.dimension_key));
  const blockers = (blockersResult.data ?? []) as unknown as BlockerRow[];
  const actions = (actionsResult.data ?? []) as unknown as ActionRow[];
  const events = (eventsResult.data ?? []) as unknown as EventRow[];

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/readiness`}>
              ← Volver a readiness
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>
              Proyecto
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={getLevelVariant(assessment.level)}>
              {getReadinessLevelLabel(assessment.level)}
            </Badge>
            <Badge variant="outline">
              {assessment.source === "agent" ? "Readiness Assessor" : "Determinista"}
            </Badge>
            {assessment.project_model_version_number ? (
              <Badge variant="outline">
                Model v{assessment.project_model_version_number}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Snapshot de readiness
          </h1>
          <p className="mt-2 font-medium">{project.name}</p>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Evaluación inmutable creada el {formatDate(assessment.created_at)}.
            Los estados de bloqueadores y acciones muestran su seguimiento actual,
            mientras los scores y la evidencia permanecen congelados.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-5xl">
                {assessment.overall_score}
                <span className="text-xl text-muted-foreground">/100</span>
              </CardTitle>
              <CardDescription>{assessment.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={assessment.overall_score} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Bloqueadores</p>
                  <p className="text-xl font-semibold">{assessment.blocker_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Críticos</p>
                  <p className="text-xl font-semibold">{assessment.critical_blocker_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Altos</p>
                  <p className="text-xl font-semibold">{assessment.high_blocker_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Medios</p>
                  <p className="text-xl font-semibold">{assessment.medium_blocker_count}</p>
                </div>
              </div>
              {assessment.confidence !== null ? (
                <p className="text-sm text-muted-foreground">
                  Confianza reportada: {Math.round(assessment.confidence * 100)}%
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dimensiones</CardTitle>
              <CardDescription>
                Evidencia y brechas registradas al momento de evaluar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {dimensions.map((dimension) => (
                <div key={dimension.dimension_key} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {getReadinessDimensionLabel(dimension.dimension_key)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {dimension.rationale}
                      </p>
                    </div>
                    <Badge variant={dimension.score >= 75 ? "default" : dimension.score >= 50 ? "secondary" : "destructive"}>
                      {dimension.score}
                    </Badge>
                  </div>
                  <Progress value={dimension.score} />

                  {dimension.evidence.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium">Evidencia</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {dimension.evidence.map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {dimension.gaps.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium">Brechas</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {dimension.gaps.map((gap) => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Bloqueadores registrados
            </h2>
            <div className="space-y-4">
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
                      <Badge variant="outline">{blocker.status}</Badge>
                    </div>
                    <CardTitle>{blocker.title}</CardTitle>
                    <CardDescription>{blocker.reason}</CardDescription>
                  </CardHeader>
                  {blocker.review_comment || blocker.evidence.length > 0 ? (
                    <CardContent className="space-y-3">
                      {blocker.evidence.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {blocker.evidence.map((evidence) => (
                            <li key={evidence}>{evidence}</li>
                          ))}
                        </ul>
                      ) : null}
                      {blocker.review_comment ? (
                        <p className="rounded-lg border p-3 text-sm">
                          {blocker.review_comment}
                        </p>
                      ) : null}
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Acciones registradas
            </h2>
            <div className="space-y-4">
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
                      <Badge variant="outline">{action.status}</Badge>
                    </div>
                    <CardTitle>{action.action}</CardTitle>
                    <CardDescription>
                      {action.owner_role} · {action.expected_outcome}
                    </CardDescription>
                  </CardHeader>
                  {action.review_comment ? (
                    <CardContent>
                      <p className="rounded-lg border p-3 text-sm">
                        {action.review_comment}
                      </p>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        </div>

        <Separator className="my-8" />

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Auditoría de seguimiento</CardTitle>
              <CardDescription>
                Cambios de estado realizados después de crear el snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No existen transiciones registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{event.item_type}</Badge>
                        <span>
                          {event.status_from ?? "inicial"} → {event.status_to}
                        </span>
                      </div>
                      {event.comment ? (
                        <p className="mt-2 text-muted-foreground">
                          {event.comment}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Snapshot de evidencia</CardTitle>
              <CardDescription>
                Metadata técnica usada para preservar trazabilidad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[28rem] overflow-auto rounded-lg bg-muted p-4 text-xs">
                {JSON.stringify(assessment.evidence_snapshot, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
