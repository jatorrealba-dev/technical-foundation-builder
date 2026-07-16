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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  calculateUsagePercentage,
  canManageAiPolicy,
  defaultOrganizationAiPolicy,
} from "@/domain/operations/ai-governance";
import type { OrganizationRole } from "@/domain/organizations/membership";
import { createClient } from "@/lib/supabase/server";

import {
  recoverStaleAgentRunsAction,
  updateOrganizationAiPolicyAction,
} from "./actions";

type AiSettingsPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    error?: string;
    updated?: string;
    recovered?: string;
  }>;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type MembershipRow = {
  role: OrganizationRole;
};

type PolicyRow = {
  organization_id: string;
  ai_enabled: boolean;
  daily_run_limit_per_user: number;
  monthly_token_limit: number;
  max_concurrent_runs_per_user: number;
  max_concurrent_runs_per_project_agent: number;
  run_timeout_seconds: number;
  updated_at: string;
};

type UsageRow = {
  month_started_at: string;
  monthly_runs: number;
  monthly_completed_runs: number;
  monthly_failed_runs: number;
  monthly_total_tokens: number;
  active_runs: number;
  current_user_daily_runs: number;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es").format(value);
}

export default async function AiSettingsPage({
  params,
  searchParams,
}: AiSettingsPageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [organizationResult, membershipResult, policyResult, usageResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organization_ai_policies")
        .select(
          "organization_id, ai_enabled, daily_run_limit_per_user, monthly_token_limit, max_concurrent_runs_per_user, max_concurrent_runs_per_project_agent, run_timeout_seconds, updated_at"
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase.rpc("get_organization_ai_usage", {
        target_organization_id: organizationId,
      }),
    ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  if (!organizationResult.data || !membershipResult.data) {
    redirect("/dashboard");
  }

  if (policyResult.error) {
    throw new Error(policyResult.error.message);
  }

  if (usageResult.error) {
    throw new Error(usageResult.error.message);
  }

  const organization =
    organizationResult.data as unknown as OrganizationRow;
  const membership =
    membershipResult.data as unknown as MembershipRow;
  const managesPolicy = canManageAiPolicy(membership.role);

  const policy = policyResult.data
    ? (policyResult.data as unknown as PolicyRow)
    : {
        organization_id: organizationId,
        ai_enabled: defaultOrganizationAiPolicy.aiEnabled,
        daily_run_limit_per_user:
          defaultOrganizationAiPolicy.dailyRunLimitPerUser,
        monthly_token_limit:
          defaultOrganizationAiPolicy.monthlyTokenLimit,
        max_concurrent_runs_per_user:
          defaultOrganizationAiPolicy.maxConcurrentRunsPerUser,
        max_concurrent_runs_per_project_agent:
          defaultOrganizationAiPolicy.maxConcurrentRunsPerProjectAgent,
        run_timeout_seconds:
          defaultOrganizationAiPolicy.runTimeoutSeconds,
        updated_at: new Date().toISOString(),
      };

  const usage = (
    usageResult.data as unknown as UsageRow[]
  )?.[0] ?? {
    month_started_at: new Date().toISOString(),
    monthly_runs: 0,
    monthly_completed_runs: 0,
    monthly_failed_runs: 0,
    monthly_total_tokens: 0,
    active_runs: 0,
    current_user_daily_runs: 0,
  };

  const tokenUsagePercentage = calculateUsagePercentage(
    usage.monthly_total_tokens,
    policy.monthly_token_limit
  );
  const dailyUsagePercentage = calculateUsagePercentage(
    usage.current_user_daily_runs,
    policy.daily_run_limit_per_user
  );

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/dashboard?organizationId=${organizationId}`}>
              ← Volver al dashboard
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}/team`}>
              Administrar equipo
            </Link>
          </Button>
        </div>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Production Hardening v10</Badge>
            <Badge variant={policy.ai_enabled ? "default" : "outline"}>
              {policy.ai_enabled ? "IA habilitada" : "IA deshabilitada"}
            </Badge>
            <Badge variant="outline">{membership.role}</Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Operación de IA · {organization.name}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Controla presupuesto, concurrencia, timeouts y recuperación de
            ejecuciones sin exponer secretos del proveedor.
          </p>
        </header>

        {query.error ? (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {query.error}
          </div>
        ) : null}

        {query.updated === "1" ? (
          <div className="mb-6 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            La política operativa de IA fue actualizada.
          </div>
        ) : null}

        {query.recovered !== undefined ? (
          <div className="mb-6 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Recuperación terminada: {query.recovered} ejecuciones cerradas.
          </div>
        ) : null}

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto mensual</CardTitle>
              <CardDescription>
                Tokens completados desde el inicio del mes actual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={tokenUsagePercentage}>
                <ProgressLabel>Tokens</ProgressLabel>
                <ProgressValue>
                  {`${formatNumber(usage.monthly_total_tokens)} / ${formatNumber(
                    policy.monthly_token_limit
                  )}`}
                </ProgressValue>
              </Progress>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-medium">Ejecuciones</p>
                  <p className="text-muted-foreground">{usage.monthly_runs}</p>
                </div>
                <div>
                  <p className="font-medium">Completadas</p>
                  <p className="text-muted-foreground">{usage.monthly_completed_runs}</p>
                </div>
                <div>
                  <p className="font-medium">Fallidas</p>
                  <p className="text-muted-foreground">{usage.monthly_failed_runs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uso del usuario</CardTitle>
              <CardDescription>
                Consumo diario y ejecuciones actualmente activas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={dailyUsagePercentage}>
                <ProgressLabel>Ejecuciones de hoy</ProgressLabel>
                <ProgressValue>
                  {`${usage.current_user_daily_runs} / ${policy.daily_run_limit_per_user}`}
                </ProgressValue>
              </Progress>
              <div className="text-sm">
                <p className="font-medium">Ejecuciones activas en la organización</p>
                <p className="text-muted-foreground">{usage.active_runs}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Política de ejecución</CardTitle>
            <CardDescription>
              Los límites se aplican atómicamente en PostgreSQL antes de llamar
              a OpenAI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {managesPolicy ? (
              <form action={updateOrganizationAiPolicyAction} className="space-y-6">
                <input type="hidden" name="organizationId" value={organizationId} />

                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <input
                    type="checkbox"
                    name="aiEnabled"
                    defaultChecked={policy.ai_enabled}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="block font-medium">Habilitar agentes de IA</span>
                    <span className="block text-sm text-muted-foreground">
                      Desactivar esta opción bloquea nuevas reservas sin borrar el historial.
                    </span>
                  </span>
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dailyRunLimitPerUser">Límite diario por usuario</Label>
                    <Input
                      id="dailyRunLimitPerUser"
                      name="dailyRunLimitPerUser"
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={policy.daily_run_limit_per_user}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyTokenLimit">Presupuesto mensual de tokens</Label>
                    <Input
                      id="monthlyTokenLimit"
                      name="monthlyTokenLimit"
                      type="number"
                      min={1000}
                      max={1_000_000_000}
                      step={1000}
                      defaultValue={policy.monthly_token_limit}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrentRunsPerUser">Concurrencia por usuario</Label>
                    <Input
                      id="maxConcurrentRunsPerUser"
                      name="maxConcurrentRunsPerUser"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={policy.max_concurrent_runs_per_user}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrentRunsPerProjectAgent">Concurrencia por agente/proyecto</Label>
                    <Input
                      id="maxConcurrentRunsPerProjectAgent"
                      name="maxConcurrentRunsPerProjectAgent"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={policy.max_concurrent_runs_per_project_agent}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="runTimeoutSeconds">Timeout por ejecución (segundos)</Label>
                    <Input
                      id="runTimeoutSeconds"
                      name="runTimeoutSeconds"
                      type="number"
                      min={30}
                      max={900}
                      defaultValue={policy.run_timeout_seconds}
                      required
                    />
                  </div>
                </div>

                <Button type="submit">Guardar política</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Puedes consultar el consumo, pero solo owner o admin pueden
                modificar la política operativa.
              </p>
            )}
          </CardContent>
        </Card>

        {managesPolicy ? (
          <Card>
            <CardHeader>
              <CardTitle>Recuperación operacional</CardTitle>
              <CardDescription>
                Cierra ejecuciones que permanezcan activas más allá de su timeout
                y registra el evento de recuperación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={recoverStaleAgentRunsAction}>
                <input type="hidden" name="organizationId" value={organizationId} />
                <Button type="submit" variant="outline">
                  Recuperar ejecuciones estancadas
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
