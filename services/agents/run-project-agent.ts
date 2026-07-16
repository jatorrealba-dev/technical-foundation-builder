import "server-only";

import {
  run,
  setDefaultOpenAIKey,
  setTracingDisabled,
} from "@openai/agents";

import { createProjectAgent } from "@/agents/create-project-agent";
import { getAgentDefinition } from "@/agents/registry";
import type { AgentKey } from "@/domain/agents/agent";
import {
  classifyAgentRuntimeError,
  getAiRuntimeErrorMessage,
} from "@/domain/operations/ai-governance";
import { requireAiRuntimeConfiguration } from "@/lib/ai/config";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logOperationalEvent } from "@/lib/observability/logger";
import { sanitizeOperationalError } from "@/lib/runtime/error-sanitization";
import { createClient } from "@/lib/supabase/server";
import { runWithTimeout } from "@/services/operations/run-with-timeout";

import {
  buildProjectAgentInput,
  loadProjectAgentContext,
} from "./project-agent-context";

type ExecuteProjectAgentInput = {
  projectId: string;
  agentKey: AgentKey;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export type ExecuteProjectAgentResult =
  | {
      ok: true;
      runId: string;
      output: unknown;
    }
  | {
      ok: false;
      error: string;
      runId?: string;
    };

type AgentRunReservationRow = {
  run_id: string;
  run_timeout_seconds: number;
  daily_runs_used: number;
  daily_runs_limit: number;
  monthly_tokens_used: number;
  monthly_tokens_limit: number;
};

function getErrorMessage(error: unknown): string {
  return sanitizeOperationalError(
    error,
    "Ocurrió un error desconocido al ejecutar el agente."
  );
}

export async function executeProjectAgent(
  input: ExecuteProjectAgentInput
): Promise<ExecuteProjectAgentResult> {
  let runId: string | undefined;
  const correlationId = createCorrelationId();
  const startedAt = new Date();
  let organizationId: string | undefined;

  try {
    const configuration = requireAiRuntimeConfiguration();
    const definition = getAgentDefinition(input.agentKey);

    const contextResult = await loadProjectAgentContext({
      supabase: input.supabase,
      projectId: input.projectId,
    });

    if (!contextResult.ok) {
      return contextResult;
    }

    organizationId =
      contextResult.context.project.organization_id;

    if (
      definition.requiresProjectModel &&
      !contextResult.context.projectModel
    ) {
      return {
        ok: false,
        error:
          "Este agente requiere un Project Model generado.",
      };
    }

    if (
      definition.requiresArtifacts &&
      contextResult.context.artifacts.length === 0
    ) {
      return {
        ok: false,
        error:
          "Este agente requiere documentos generados para poder comparar evidencia.",
      };
    }

    const { data: reservationData, error: reservationError } =
      await input.supabase.rpc("reserve_agent_run", {
        target_project_id: input.projectId,
        target_agent_key: input.agentKey,
        target_provider: "openai",
        target_model: configuration.model,
        target_prompt_version: definition.promptVersion,
        target_input_snapshot: contextResult.context,
        target_correlation_id: correlationId,
      });

    if (reservationError) {
      const message = getErrorMessage(reservationError.message);
      const failureCode = classifyAgentRuntimeError(message);

      logOperationalEvent({
        level: "warn",
        event: "agent.run.rejected",
        correlationId,
        organizationId,
        projectId: input.projectId,
        userId: input.userId,
        metadata: {
          agentKey: input.agentKey,
          failureCode,
        },
      });

      return {
        ok: false,
        error: getAiRuntimeErrorMessage(message),
      };
    }

    const reservation = (
      reservationData as unknown as AgentRunReservationRow[]
    )?.[0];

    if (!reservation?.run_id) {
      return {
        ok: false,
        error:
          "No se pudo reservar la ejecución del agente.",
      };
    }

    runId = reservation.run_id;

    logOperationalEvent({
      level: "info",
      event: "agent.run.started",
      correlationId,
      organizationId,
      projectId: input.projectId,
      runId,
      userId: input.userId,
      metadata: {
        agentKey: input.agentKey,
        model: configuration.model,
        promptVersion: definition.promptVersion,
        timeoutSeconds: reservation.run_timeout_seconds,
        dailyRunsUsed: reservation.daily_runs_used,
        dailyRunsLimit: reservation.daily_runs_limit,
        monthlyTokensUsed: reservation.monthly_tokens_used,
        monthlyTokensLimit: reservation.monthly_tokens_limit,
      },
    });

    setDefaultOpenAIKey(configuration.apiKey);
    setTracingDisabled(!configuration.tracingEnabled);

    const agent = createProjectAgent({
      key: input.agentKey,
      model: configuration.model,
    });

    const result = await runWithTimeout(
      run(
        agent,
        buildProjectAgentInput(contextResult.context),
        {
          maxTurns: configuration.maxTurns,
        }
      ),
      reservation.run_timeout_seconds
    );

    if (result.finalOutput === undefined) {
      throw new Error(
        "El agente terminó sin producir una salida estructurada."
      );
    }

    const completedAt = new Date();
    const usage = result.state.usage;
    const latencyMs =
      completedAt.getTime() - startedAt.getTime();

    const { error: completionError } =
      await input.supabase.rpc("complete_agent_run", {
        target_run_id: runId,
        target_output: result.finalOutput,
        target_input_tokens: usage.inputTokens,
        target_output_tokens: usage.outputTokens,
        target_total_tokens: usage.totalTokens,
        target_latency_ms: latencyMs,
      });

    if (completionError) {
      throw new Error(
        `El agente respondió, pero no se pudo persistir el resultado: ${completionError.message}`
      );
    }

    logOperationalEvent({
      level: "info",
      event: "agent.run.completed",
      correlationId,
      organizationId,
      projectId: input.projectId,
      runId,
      userId: input.userId,
      durationMs: latencyMs,
      metadata: {
        agentKey: input.agentKey,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
    });

    return {
      ok: true,
      runId,
      output: result.finalOutput,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const failureCode = classifyAgentRuntimeError(message);
    const completedAt = new Date();
    const latencyMs =
      completedAt.getTime() - startedAt.getTime();

    if (runId) {
      const { error: failureError } =
        await input.supabase.rpc("fail_agent_run", {
          target_run_id: runId,
          target_failure_code: failureCode,
          target_error_message: message,
          target_latency_ms: latencyMs,
        });

      if (failureError) {
        logOperationalEvent({
          level: "error",
          event: "agent.run.failure_persistence_failed",
          correlationId,
          organizationId,
          projectId: input.projectId,
          runId,
          userId: input.userId,
          durationMs: latencyMs,
          metadata: {
            failureCode,
            persistenceError: sanitizeOperationalError(
              failureError.message
            ),
          },
        });
      }
    }

    logOperationalEvent({
      level: "error",
      event: "agent.run.failed",
      correlationId,
      organizationId,
      projectId: input.projectId,
      runId,
      userId: input.userId,
      durationMs: latencyMs,
      metadata: {
        agentKey: input.agentKey,
        failureCode,
      },
    });

    return {
      ok: false,
      error: getAiRuntimeErrorMessage(message),
      runId,
    };
  }
}
