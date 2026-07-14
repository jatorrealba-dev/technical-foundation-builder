import Link from "next/link";
import { redirect } from "next/navigation";

import { agentCatalog, getAgentDefinition } from "@/agents/registry";
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
  AgentKey,
  AgentRunStatus,
} from "@/domain/agents/agent";
import { getAiConfigurationStatus } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";

import { runProjectAgentFormAction } from "./actions";

type ProjectAgentsPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    run?: string | string[];
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
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
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLatency(value: number | null): string {
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
): "default" | "secondary" | "outline" | "destructive" {
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

export default async function ProjectAgentsPage({
  params,
  searchParams,
}: ProjectAgentsPageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const errorParam = resolvedSearchParams.error;
  const runParam = resolvedSearchParams.run;

  const actionError = Array.isArray(errorParam)
    ? errorParam[0]
    : errorParam;

  const completedRunId = Array.isArray(runParam)
    ? runParam[0]
    : runParam;

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
    .select("id, name")
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
    count: modelCount,
    error: modelError,
  } = await supabase
    .from("project_models")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("project_id", projectId);

  if (modelError) {
    throw new Error(modelError.message);
  }

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
      "id, agent_key, status, provider, model, prompt_version, output, error_message, input_tokens, output_tokens, total_tokens, latency_ms, started_at, completed_at, created_at"
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

  const configuration =
    getAiConfigurationStatus();

  const hasProjectModel = (modelCount ?? 0) > 0;
  const hasArtifacts = (artifactCount ?? 0) > 0;

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
            Supabase. Ningún resultado actualiza automáticamente
            el Project Model ni aprueba decisiones críticas.
          </p>
        </header>

        {completedRunId ? (
          <Card className="mb-6 border-green-600">
            <CardHeader>
              <CardTitle>
                Ejecución completada
              </CardTitle>

              <CardDescription>
                La salida estructurada fue validada y guardada
                en el historial de ejecuciones.
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

        {actionError ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                No se pudo ejecutar el agente
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

          <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
          </CardContent>
        </Card>

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
            Historial de ejecuciones
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Se muestran las veinte ejecuciones más recientes del
            proyecto.
          </p>
        </div>

        {runs.length > 0 ? (
          <div className="grid gap-5">
            {runs.map((agentRun) => {
              const definition = getAgentDefinition(
                agentRun.agent_key
              );

              return (
                <Card key={agentRun.id}>
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
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
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
