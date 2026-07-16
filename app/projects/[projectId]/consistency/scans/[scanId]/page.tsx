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
import type { ArtifactType } from "@/domain/artifacts/artifact";
import type {
  ConsistencyCategory,
  ConsistencySeverity,
} from "@/domain/consistency/consistency";
import { createClient } from "@/lib/supabase/server";

type ConsistencyScanDetailPageProps = {
  params: Promise<{
    projectId: string;
    scanId: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
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
  completed_at: string | null;
};

type SnapshotRow = {
  finding_id: string;
  severity: ConsistencySeverity;
  category: ConsistencyCategory;
  title: string;
  description: string;
  evidence: string[];
  affected_artifact_types: ArtifactType[];
  recommendation: string;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function severityVariant(
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

export default async function ConsistencyScanDetailPage({
  params,
}: ConsistencyScanDetailPageProps) {
  const { projectId, scanId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [{ data: projectData, error: projectError }, {
    data: scanData,
    error: scanError,
  }, { data: snapshotData, error: snapshotError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("consistency_scans")
        .select(
          "id, source, source_run_id, project_model_version_number, status, summary, finding_count, critical_count, high_count, medium_count, low_count, info_count, created_at, completed_at"
        )
        .eq("id", scanId)
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("consistency_scan_findings")
        .select(
          "finding_id, severity, category, title, description, evidence, affected_artifact_types, recommendation, created_at"
        )
        .eq("scan_id", scanId)
        .order("created_at", { ascending: true }),
    ]);

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (scanError) {
    throw new Error(scanError.message);
  }

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  if (!projectData || !scanData) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Análisis no encontrado</CardTitle>
              <CardDescription>
                El análisis no existe o no tienes acceso al proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/projects/${projectId}/consistency`}>
                  Volver a consistencia
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const project = projectData as unknown as ProjectRow;
  const scan = scanData as unknown as ScanRow;
  const snapshots = (snapshotData ?? []) as unknown as SnapshotRow[];

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${project.id}/consistency`}>
              ← Volver a consistencia
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}`}>
              Volver al proyecto
            </Link>
          </Button>
        </div>

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={scan.source === "agent" ? "secondary" : "outline"}>
              {scan.source === "agent" ? "Consistency Reviewer" : "Motor determinista"}
            </Badge>
            <Badge variant="outline">
              Project Model v{scan.project_model_version_number ?? "—"}
            </Badge>
            <Badge variant={scan.status === "completed" ? "default" : "destructive"}>
              {scan.status === "completed" ? "Completado" : "Fallido"}
            </Badge>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Instantánea de consistencia
          </h1>
          <p className="mt-2 font-medium">{project.name}</p>
          <p className="mt-3 text-muted-foreground">
            Ejecutado el {formatDate(scan.created_at)}. Esta vista conserva
            exactamente lo observado en ese momento, aunque los hallazgos
            actuales hayan cambiado de estado.
          </p>
        </header>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Críticos", scan.critical_count],
            ["Altos", scan.high_count],
            ["Medios", scan.medium_count],
            ["Bajos", scan.low_count],
            ["Informativos", scan.info_count],
          ].map(([label, count]) => (
            <Card key={String(label)}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl">{count}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {Object.keys(scan.summary ?? {}).length > 0 ? (
          <details className="mb-8 rounded-lg border bg-muted/20">
            <summary className="cursor-pointer px-5 py-4 font-medium">
              Ver resumen técnico del análisis
            </summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t p-5 text-xs leading-6">
              {JSON.stringify(scan.summary, null, 2)}
            </pre>
          </details>
        ) : null}

        <div className="mb-5">
          <h2 className="text-2xl font-semibold tracking-tight">
            Hallazgos observados
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshots.length} registros en esta instantánea.
          </p>
        </div>

        {snapshots.length > 0 ? (
          <div className="grid gap-5">
            {snapshots.map((finding) => (
              <Card key={finding.finding_id}>
                <CardHeader>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge variant={severityVariant(finding.severity)}>
                      {finding.severity}
                    </Badge>
                    <Badge variant="outline">{finding.category}</Badge>
                  </div>
                  <CardTitle className="text-xl">{finding.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-7">{finding.description}</p>

                  {finding.evidence.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {finding.evidence.map((evidence, index) => (
                        <li key={`${finding.finding_id}-${index}`}>
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {finding.affected_artifact_types.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {finding.affected_artifact_types.map((artifactType) => (
                        <Badge key={artifactType} variant="outline">
                          {artifactType}
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sin hallazgos</CardTitle>
              <CardDescription>
                El análisis se completó sin detectar inconsistencias.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </main>
  );
}
