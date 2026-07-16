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
import type { ArtifactType } from "@/domain/artifacts/artifact";
import {
  consistencyCategories,
  consistencyFindingStatuses,
  consistencySeverities,
  type ConsistencyCategory,
  type ConsistencyFindingStatus,
  type ConsistencySeverity,
} from "@/domain/consistency/consistency";
import { canManageAgentReviews } from "@/domain/organizations/membership";
import { createClient } from "@/lib/supabase/server";

import {
  importConsistencyAgentRunFormAction,
  runDeterministicConsistencyScanFormAction,
} from "./actions";
import { FindingReviewControls } from "./finding-review-controls";
import {
  ImportAgentScanButton,
  RunDeterministicScanButton,
} from "./scan-action-buttons";

type ConsistencyPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    scanned?: string | string[];
    imported?: string | string[];
    updated?: string | string[];
    scan?: string | string[];
    status?: string | string[];
    severity?: string | string[];
    category?: string | string[];
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

type VersionRow = {
  id: string;
  version_number: number;
};

type ScanRow = {
  id: string;
  source: "deterministic" | "agent";
  source_run_id: string | null;
  project_model_version_number: number | null;
  status: "completed" | "failed";
  summary: Record<string, unknown>;
  finding_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  created_at: string;
};

type FindingRow = {
  id: string;
  fingerprint: string;
  rule_key: string;
  last_source: "deterministic" | "agent";
  severity: ConsistencySeverity;
  category: ConsistencyCategory;
  title: string;
  description: string;
  evidence: string[];
  affected_artifact_types: ArtifactType[];
  recommendation: string;
  status: ConsistencyFindingStatus;
  resolution_comment: string | null;
  occurrence_count: number;
  reviewed_at: string | null;
  resolved_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type FindingEventRow = {
  id: string;
  finding_id: string;
  event_type: string;
  status_from: ConsistencyFindingStatus | null;
  status_to: ConsistencyFindingStatus | null;
  comment: string | null;
  created_at: string;
};

type AgentRunRow = {
  id: string;
  created_at: string;
};

type ReviewRow = {
  run_id: string;
  decision: string;
};

type ImportedRunRow = {
  source_run_id: string | null;
};

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

function getSeverityVariant(
  severity: ConsistencySeverity
): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "critical" || severity === "high") {
    return "destructive";
  }

  if (severity === "medium") {
    return "secondary";
  }

  return "outline";
}

function getStatusVariant(
  status: ConsistencyFindingStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "resolved":
      return "default";
    case "accepted":
      return "secondary";
    case "dismissed":
      return "outline";
    default:
      return "destructive";
  }
}

function getStatusLabel(
  status: ConsistencyFindingStatus
): string {
  switch (status) {
    case "accepted":
      return "Aceptado";
    case "dismissed":
      return "Descartado";
    case "resolved":
      return "Resuelto";
    default:
      return "Abierto";
  }
}

function getCategoryLabel(
  category: ConsistencyCategory
): string {
  const labels: Record<ConsistencyCategory, string> = {
    requirement_gap: "Requisitos",
    domain_gap: "Dominio",
    data_gap: "Datos",
    security_gap: "Seguridad",
    architecture_gap: "Arquitectura",
    delivery_gap: "Entrega",
    contradiction: "Contradicción",
    stale_artifact: "Documento obsoleto",
  };

  return labels[category];
}

function buildFilterHref(input: {
  projectId: string;
  status?: string | null;
  severity?: string | null;
  category?: string | null;
}): string {
  const params = new URLSearchParams();

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.severity) {
    params.set("severity", input.severity);
  }

  if (input.category) {
    params.set("category", input.category);
  }

  const query = params.toString();
  return `/projects/${input.projectId}/consistency${
    query ? `?${query}` : ""
  }`;
}

export default async function ConsistencyPage({
  params,
  searchParams,
}: ConsistencyPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const error = firstSearchParam(resolvedSearchParams.error);
  const scanned = firstSearchParam(resolvedSearchParams.scanned) === "1";
  const imported = firstSearchParam(resolvedSearchParams.imported) === "1";
  const updated = firstSearchParam(resolvedSearchParams.updated) === "1";
  const highlightedScanId = firstSearchParam(
    resolvedSearchParams.scan
  );

  const statusFilterValue = firstSearchParam(
    resolvedSearchParams.status
  );
  const severityFilterValue = firstSearchParam(
    resolvedSearchParams.severity
  );
  const categoryFilterValue = firstSearchParam(
    resolvedSearchParams.category
  );

  const statusFilter = consistencyFindingStatuses.includes(
    statusFilterValue as ConsistencyFindingStatus
  )
    ? (statusFilterValue as ConsistencyFindingStatus)
    : null;

  const severityFilter = consistencySeverities.includes(
    severityFilterValue as ConsistencySeverity
  )
    ? (severityFilterValue as ConsistencySeverity)
    : null;

  const categoryFilter = consistencyCategories.includes(
    categoryFilterValue as ConsistencyCategory
  )
    ? (categoryFilterValue as ConsistencyCategory)
    : null;

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
                <Link href="/dashboard">Volver al dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const project = projectData as unknown as ProjectRow;

  const [{ data: membershipData, error: membershipError }, {
    data: versionData,
    error: versionError,
  }, { data: scanData, error: scanError }, {
    data: findingData,
    error: findingError,
  }, { data: eventData, error: eventError }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("project_model_versions")
      .select("id, version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("consistency_scans")
      .select(
        "id, source, source_run_id, project_model_version_number, status, summary, finding_count, critical_count, high_count, medium_count, low_count, info_count, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("consistency_findings")
      .select(
        "id, fingerprint, rule_key, last_source, severity, category, title, description, evidence, affected_artifact_types, recommendation, status, resolution_comment, occurrence_count, reviewed_at, resolved_at, first_seen_at, last_seen_at"
      )
      .eq("project_id", projectId)
      .order("last_seen_at", { ascending: false })
      .limit(250),
    supabase
      .from("consistency_finding_events")
      .select(
        "id, finding_id, event_type, status_from, status_to, comment, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (versionError) {
    throw new Error(versionError.message);
  }

  if (scanError) {
    throw new Error(
      `${scanError.message}. Aplica la migración 0010_consistency_engine.sql.`
    );
  }

  if (findingError) {
    throw new Error(findingError.message);
  }

  if (eventError) {
    throw new Error(eventError.message);
  }

  const membershipRole = membershipData
    ? (membershipData as unknown as MembershipRow).role
    : null;
  const canManage = canManageAgentReviews(membershipRole);
  const currentVersion = versionData
    ? (versionData as unknown as VersionRow)
    : null;
  const scans = (scanData ?? []) as unknown as ScanRow[];
  const findings = (findingData ?? []) as unknown as FindingRow[];
  const events = (eventData ?? []) as unknown as FindingEventRow[];
  const eventsByFindingId = new Map<string, FindingEventRow[]>();

  for (const event of events) {
    const existing = eventsByFindingId.get(event.finding_id) ?? [];
    existing.push(event);
    eventsByFindingId.set(event.finding_id, existing);
  }

  const latestScan = scans[0] ?? null;

  const filteredFindings = findings.filter((finding) => {
    return (
      (!statusFilter || finding.status === statusFilter) &&
      (!severityFilter || finding.severity === severityFilter) &&
      (!categoryFilter || finding.category === categoryFilter)
    );
  });

  const openCount = findings.filter(
    (finding) => finding.status === "open"
  ).length;
  const acceptedCount = findings.filter(
    (finding) => finding.status === "accepted"
  ).length;
  const resolvedCount = findings.filter(
    (finding) => finding.status === "resolved"
  ).length;
  const criticalHighCount = findings.filter(
    (finding) =>
      finding.status !== "resolved" &&
      finding.status !== "dismissed" &&
      (finding.severity === "critical" ||
        finding.severity === "high")
  ).length;

  const scanIsOutdated = Boolean(
    latestScan &&
      currentVersion &&
      latestScan.project_model_version_number !== null &&
      latestScan.project_model_version_number <
        currentVersion.version_number
  );

  const { data: consistencyRunData, error: consistencyRunsError } =
    await supabase
      .from("agent_runs")
      .select("id, created_at")
      .eq("project_id", projectId)
      .eq("agent_key", "consistency")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);

  if (consistencyRunsError) {
    throw new Error(consistencyRunsError.message);
  }

  const consistencyRuns = (
    consistencyRunData ?? []
  ) as unknown as AgentRunRow[];

  let importableRuns: AgentRunRow[] = [];

  if (consistencyRuns.length > 0) {
    const runIds = consistencyRuns.map((run) => run.id);
    const [{ data: reviewRows, error: reviewError }, {
      data: importedRows,
      error: importedError,
    }] = await Promise.all([
      supabase
        .from("agent_run_reviews")
        .select("run_id, decision")
        .eq("project_id", projectId)
        .in("run_id", runIds),
      supabase
        .from("consistency_scans")
        .select("source_run_id")
        .eq("project_id", projectId)
        .in("source_run_id", runIds),
    ]);

    if (reviewError) {
      throw new Error(reviewError.message);
    }

    if (importedError) {
      throw new Error(importedError.message);
    }

    const approvedRunIds = new Set(
      ((reviewRows ?? []) as unknown as ReviewRow[])
        .filter((review) => review.decision === "approved")
        .map((review) => review.run_id)
    );

    const importedRunIds = new Set(
      ((importedRows ?? []) as unknown as ImportedRunRow[])
        .map((row) => row.source_run_id)
        .filter((value): value is string => value !== null)
    );

    importableRuns = consistencyRuns.filter(
      (run) =>
        approvedRunIds.has(run.id) &&
        !importedRunIds.has(run.id)
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}`}>
              ← Volver al proyecto
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/analysis`}>
              Ver Project Model
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/documents`}>
              Ver documentos
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/agents`}>
              Agentes IA
            </Link>
          </Button>
        </div>

        <header className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Consistency Engine v1</Badge>
              <Badge variant={criticalHighCount > 0 ? "destructive" : "default"}>
                {criticalHighCount} críticos o altos activos
              </Badge>
              {scanIsOutdated ? (
                <Badge variant="destructive">Análisis desactualizado</Badge>
              ) : latestScan ? (
                <Badge variant="outline">Análisis vigente</Badge>
              ) : null}
            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Consistencia del proyecto
            </h1>
            <p className="mt-2 font-medium">{project.name}</p>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Verifica trazabilidad entre el Project Model y los documentos,
              consolida hallazgos deterministas y de IA, evita duplicados y
              conserva un historial auditable de decisiones humanas.
            </p>
          </div>

          <form action={runDeterministicConsistencyScanFormAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <RunDeterministicScanButton />
          </form>
        </header>

        {error ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo completar la operación
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {scanned || imported || updated ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                {scanned
                  ? "Verificación determinista completada"
                  : imported
                    ? "Hallazgos de IA importados"
                    : "Hallazgo actualizado"}
              </CardTitle>
              <CardDescription>
                {updated
                  ? "La decisión humana quedó guardada en el historial del hallazgo."
                  : "Los resultados se deduplicaron y quedaron asociados a la versión analizada del Project Model."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Abiertos</CardDescription>
              <CardTitle className="text-3xl">{openCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aceptados</CardDescription>
              <CardTitle className="text-3xl">{acceptedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resueltos</CardDescription>
              <CardTitle className="text-3xl">{resolvedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Escaneos</CardDescription>
              <CardTitle className="text-3xl">{scans.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {importableRuns.length > 0 ? (
          <Card className="mb-8 border-amber-500/60">
            <CardHeader>
              <CardTitle>Resultados de IA listos para importar</CardTitle>
              <CardDescription>
                Estas ejecuciones de Consistency Reviewer ya fueron aprobadas,
                pero sus hallazgos todavía no forman parte del registro gobernado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {importableRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">Consistency Reviewer</p>
                    <p className="text-sm text-muted-foreground">
                      Ejecutado el {formatDate(run.created_at)}
                    </p>
                  </div>
                  <form action={importConsistencyAgentRunFormAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="runId" value={run.id} />
                    <ImportAgentScanButton />
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[1fr_0.36fr]">
          <div>
            <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Hallazgos gobernados
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {filteredFindings.length} de {findings.length} hallazgos visibles.
                </p>
              </div>

              <Button variant="outline" asChild>
                <Link href={`/projects/${project.id}/consistency`}>
                  Limpiar filtros
                </Link>
              </Button>
            </div>

            <div className="mb-6 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                <span className="mr-2 text-sm font-medium">Estado:</span>
                {consistencyFindingStatuses.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={statusFilter === status ? "default" : "outline"}
                    asChild
                  >
                    <Link
                      href={buildFilterHref({
                        projectId: project.id,
                        status,
                        severity: severityFilter,
                        category: categoryFilter,
                      })}
                    >
                      {getStatusLabel(status)}
                    </Link>
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="mr-2 text-sm font-medium">Severidad:</span>
                {consistencySeverities.map((severity) => (
                  <Button
                    key={severity}
                    size="sm"
                    variant={severityFilter === severity ? "default" : "outline"}
                    asChild
                  >
                    <Link
                      href={buildFilterHref({
                        projectId: project.id,
                        status: statusFilter,
                        severity,
                        category: categoryFilter,
                      })}
                    >
                      {severity}
                    </Link>
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="mr-2 text-sm font-medium">Categoría:</span>
                {consistencyCategories.map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant={categoryFilter === category ? "default" : "outline"}
                    asChild
                  >
                    <Link
                      href={buildFilterHref({
                        projectId: project.id,
                        status: statusFilter,
                        severity: severityFilter,
                        category,
                      })}
                    >
                      {getCategoryLabel(category)}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>

            {filteredFindings.length > 0 ? (
              <div className="grid gap-5">
                {filteredFindings.map((finding) => (
                  <Card id={`finding-${finding.id}`} key={finding.id}>
                    <CardHeader>
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge variant={getSeverityVariant(finding.severity)}>
                              {finding.severity}
                            </Badge>
                            <Badge variant="outline">
                              {getCategoryLabel(finding.category)}
                            </Badge>
                            <Badge variant={getStatusVariant(finding.status)}>
                              {getStatusLabel(finding.status)}
                            </Badge>
                            <Badge variant="secondary">
                              {finding.last_source === "agent" ? "IA" : "Regla"}
                            </Badge>
                          </div>
                          <CardTitle className="text-xl">
                            {finding.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            Visto {finding.occurrence_count} vez
                            {finding.occurrence_count === 1 ? "" : "es"} · última detección {formatDate(finding.last_seen_at)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <p className="text-sm leading-7">
                        {finding.description}
                      </p>

                      {finding.evidence.length > 0 ? (
                        <div>
                          <p className="text-sm font-medium">Evidencia</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {finding.evidence.map((evidence, index) => (
                              <li key={`${finding.id}-evidence-${index}`}>
                                {evidence}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {finding.affected_artifact_types.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {finding.affected_artifact_types.map((type) => (
                            <Badge key={type} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <div className="rounded-lg border bg-muted/20 p-4">
                        <p className="text-sm font-medium">Recomendación</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {finding.recommendation}
                        </p>
                      </div>

                      {finding.resolution_comment ? (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm font-medium">Decisión registrada</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {finding.resolution_comment}
                          </p>
                        </div>
                      ) : null}

                      {(eventsByFindingId.get(finding.id) ?? []).length > 0 ? (
                        <details className="rounded-lg border bg-muted/10">
                          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                            Ver historial del hallazgo
                          </summary>
                          <div className="space-y-3 border-t p-4">
                            {(eventsByFindingId.get(finding.id) ?? []).map((event) => (
                              <div key={event.id} className="text-sm">
                                <p className="font-medium">
                                  {event.event_type}
                                  {event.status_from || event.status_to
                                    ? ` · ${event.status_from ?? "—"} → ${event.status_to ?? "—"}`
                                    : ""}
                                </p>
                                <p className="text-muted-foreground">
                                  {formatDate(event.created_at)}
                                </p>
                                {event.comment ? (
                                  <p className="mt-1 text-muted-foreground">
                                    {event.comment}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      {canManage ? (
                        <FindingReviewControls
                          projectId={project.id}
                          findingId={finding.id}
                          status={finding.status}
                          resolutionComment={finding.resolution_comment}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Solo un owner o admin puede cambiar el estado del hallazgo.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Sin hallazgos para estos filtros</CardTitle>
                  <CardDescription>
                    Ejecuta una verificación o cambia los filtros activos.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>

          <aside>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Historial de análisis</CardTitle>
                <CardDescription>
                  Cada ejecución conserva la versión del Project Model y una instantánea de sus hallazgos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scans.length > 0 ? (
                  <div className="space-y-4">
                    {scans.map((scan, index) => (
                      <div key={scan.id}>
                        <div
                          className={
                            scan.id === highlightedScanId
                              ? "rounded-lg border border-green-600 p-3"
                              : "rounded-lg border p-3"
                          }
                        >
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={scan.source === "agent" ? "secondary" : "outline"}>
                              {scan.source === "agent" ? "IA" : "Determinista"}
                            </Badge>
                            <Badge variant="outline">
                              v{scan.project_model_version_number ?? "—"}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm font-medium">
                            {scan.finding_count} hallazgos
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(scan.created_at)}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {scan.critical_count} críticos · {scan.high_count} altos · {scan.medium_count} medios
                          </p>
                          <Button className="mt-3 w-full" size="sm" variant="outline" asChild>
                            <Link href={`/projects/${project.id}/consistency/scans/${scan.id}`}>
                              Ver instantánea
                            </Link>
                          </Button>
                        </div>
                        {index < scans.length - 1 ? (
                          <Separator className="my-4" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no se ha ejecutado ningún análisis.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
