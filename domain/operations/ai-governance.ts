import type { OrganizationRole } from "@/domain/organizations/membership";

export type OrganizationAiPolicy = {
  organizationId: string;
  aiEnabled: boolean;
  dailyRunLimitPerUser: number;
  monthlyTokenLimit: number;
  maxConcurrentRunsPerUser: number;
  maxConcurrentRunsPerProjectAgent: number;
  runTimeoutSeconds: number;
  updatedAt: string;
};

export type OrganizationAiUsage = {
  monthStartedAt: string;
  monthlyRuns: number;
  monthlyCompletedRuns: number;
  monthlyFailedRuns: number;
  monthlyTotalTokens: number;
  activeRuns: number;
  currentUserDailyRuns: number;
};

export const defaultOrganizationAiPolicy = {
  aiEnabled: true,
  dailyRunLimitPerUser: 20,
  monthlyTokenLimit: 1_000_000,
  maxConcurrentRunsPerUser: 1,
  maxConcurrentRunsPerProjectAgent: 1,
  runTimeoutSeconds: 180,
} as const;

export const aiRuntimeErrorCodes = [
  "organization_ai_disabled",
  "ai_daily_run_limit_exceeded",
  "ai_monthly_token_limit_exceeded",
  "ai_user_concurrency_limit_exceeded",
  "ai_project_agent_concurrency_limit_exceeded",
  "agent_run_timeout",
  "agent_runtime_error",
] as const;

export type AiRuntimeErrorCode =
  (typeof aiRuntimeErrorCodes)[number];

export function canManageAiPolicy(
  role: OrganizationRole | string | null | undefined
): boolean {
  return role === "owner" || role === "admin";
}

export function calculateUsagePercentage(
  used: number,
  limit: number
): number {
  if (!Number.isFinite(used) || used <= 0) {
    return 0;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 100;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

export function getAiRuntimeErrorMessage(
  codeOrMessage: string
): string {
  if (codeOrMessage.includes("organization_ai_disabled")) {
    return "La ejecución de agentes está deshabilitada para esta organización.";
  }

  if (codeOrMessage.includes("ai_daily_run_limit_exceeded")) {
    return "Alcanzaste el límite diario de ejecuciones de IA para tu usuario.";
  }

  if (codeOrMessage.includes("ai_monthly_token_limit_exceeded")) {
    return "La organización alcanzó su presupuesto mensual de tokens.";
  }

  if (codeOrMessage.includes("ai_user_concurrency_limit_exceeded")) {
    return "Ya tienes una ejecución de IA activa. Espera a que termine antes de iniciar otra.";
  }

  if (
    codeOrMessage.includes(
      "ai_project_agent_concurrency_limit_exceeded"
    )
  ) {
    return "Este agente ya se está ejecutando para el proyecto.";
  }

  if (codeOrMessage.includes("agent_run_timeout")) {
    return "El agente excedió el tiempo máximo permitido y la ejecución fue cerrada de forma segura.";
  }

  return codeOrMessage;
}

export function classifyAgentRuntimeError(
  message: string
): AiRuntimeErrorCode {
  for (const code of aiRuntimeErrorCodes) {
    if (message.includes(code)) {
      return code;
    }
  }

  return "agent_runtime_error";
}
