import "server-only";

import {
  run,
  setDefaultOpenAIKey,
  setTracingDisabled,
} from "@openai/agents";

import { createProjectAgent } from "@/agents/create-project-agent";
import {
  classifyAgentRuntimeError,
  getAiRuntimeErrorMessage,
} from "@/domain/operations/ai-governance";
import { requireAiRuntimeConfiguration } from "@/lib/ai/config";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logOperationalEvent } from "@/lib/observability/logger";
import { sanitizeOperationalError } from "@/lib/runtime/error-sanitization";
import { createClient } from "@/lib/supabase/server";
import { discoveryAgentOutputV2Schema } from "@/schemas/discovery/discovery-agent-output-v2";
import { runWithTimeout } from "@/services/operations/run-with-timeout";

import { buildDiscoveryAgentInput } from "./build-discovery-agent-input";
import { parseDiscoveryRuntimeContext } from "./discovery-runtime-context";
import type { StartDiscoveryTurnResult } from "./discovery-persistence";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ReservationRow = {
  run_id: string;
  run_timeout_seconds: number;
};

export type RunConversationalDiscoveryResult =
  | {
      ok: true;
      sessionId: string;
      turnId: string;
      assistantMessage: string | null;
      shouldProcess: boolean;
      idempotent: boolean;
      turnMode: StartDiscoveryTurnResult["turn_mode"];
    }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  return sanitizeOperationalError(
    error,
    "No fue posible procesar la conversación de Discovery."
  );
}

export async function runConversationalDiscovery(input: {
  projectId: string;
  content: string;
  clientMessageId: string;
  userId: string;
  supabase: SupabaseClient;
}): Promise<RunConversationalDiscoveryResult> {
  const correlationId = createCorrelationId();
  let sessionId: string | undefined;
  let turnId: string | undefined;
  let runId: string | undefined;
  const startedAt = Date.now();

  try {
    const configuration = requireAiRuntimeConfiguration();
    const { data: turnData, error: turnError } = await input.supabase.rpc(
      "start_discovery_turn",
      {
        target_project_id: input.projectId,
        target_content: input.content,
        target_client_message_id: input.clientMessageId,
      }
    );

    if (turnError) {
      throw new Error(turnError.message);
    }

    const turn = (turnData as unknown as StartDiscoveryTurnResult[])?.[0];
    if (!turn) {
      throw new Error("No se pudo iniciar el turno de Discovery.");
    }

    sessionId = turn.session_id;
    turnId = turn.turn_id;

    if (!turn.should_process) {
      return {
        ok: true,
        sessionId,
        turnId,
        assistantMessage: null,
        shouldProcess: false,
        idempotent: turn.idempotent,
        turnMode: turn.turn_mode,
      };
    }

    const { data: contextData, error: contextError } = await input.supabase.rpc(
      "get_discovery_runtime_context",
      { target_project_id: input.projectId, target_message_limit: 20 }
    );

    if (contextError) {
      throw new Error(contextError.message);
    }

    const context = parseDiscoveryRuntimeContext(contextData);
    const snapshot = {
      discoverySessionId: sessionId,
      turnId,
      userMessageId: turn.user_message_id,
      turnMode: turn.turn_mode,
      context,
    };

    const { data: reservationData, error: reservationError } =
      await input.supabase.rpc("reserve_agent_run", {
        target_project_id: input.projectId,
        target_agent_key: "discovery",
        target_provider: "openai",
        target_model: configuration.model,
        target_prompt_version: "discovery.v2",
        target_input_snapshot: snapshot,
        target_correlation_id: correlationId,
      });

    if (reservationError) {
      throw new Error(reservationError.message);
    }

    const reservation = (reservationData as unknown as ReservationRow[])?.[0];
    if (!reservation?.run_id) {
      throw new Error("No se pudo reservar la ejecución de Discovery.");
    }

    runId = reservation.run_id;
    setDefaultOpenAIKey(configuration.apiKey);
    setTracingDisabled(!configuration.tracingEnabled);

    const agent = createProjectAgent({
      key: "discovery",
      model: configuration.model,
    });

    const result = await runWithTimeout(
      run(
        agent,
        buildDiscoveryAgentInput({
          context,
          turnId,
          userMessageId: turn.user_message_id,
          turnMode: turn.turn_mode,
        }),
        { maxTurns: configuration.maxTurns }
      ),
      reservation.run_timeout_seconds
    );

    const output = discoveryAgentOutputV2Schema.parse(result.finalOutput);
    const latencyMs = Date.now() - startedAt;
    const usage = result.state.usage;

    const { error: completeRunError } = await input.supabase.rpc(
      "complete_agent_run",
      {
        target_run_id: runId,
        target_output: output,
        target_input_tokens: usage.inputTokens,
        target_output_tokens: usage.outputTokens,
        target_total_tokens: usage.totalTokens,
        target_latency_ms: latencyMs,
      }
    );

    if (completeRunError) {
      throw new Error(completeRunError.message);
    }

    const { error: recordError } = await input.supabase.rpc(
      "record_discovery_agent_output",
      {
        target_session_id: sessionId,
        target_turn_id: turnId,
        target_agent_run_id: runId,
        target_output: output,
      }
    );

    if (recordError) {
      throw new Error(recordError.message);
    }

    logOperationalEvent({
      level: "info",
      event: "discovery.turn.completed",
      correlationId,
      projectId: input.projectId,
      runId,
      userId: input.userId,
      durationMs: latencyMs,
      metadata: { turnId, turnMode: turn.turn_mode },
    });

    return {
      ok: true,
      sessionId,
      turnId,
      assistantMessage: output.assistantMessage,
      shouldProcess: true,
      idempotent: turn.idempotent,
      turnMode: turn.turn_mode,
    };
  } catch (error) {
    const message = errorMessage(error);
    const failureCode = classifyAgentRuntimeError(message);
    const latencyMs = Date.now() - startedAt;

    if (runId) {
      await input.supabase.rpc("fail_agent_run", {
        target_run_id: runId,
        target_failure_code: failureCode,
        target_error_message: message,
        target_latency_ms: latencyMs,
      });
    }

    if (sessionId && turnId) {
      await input.supabase.rpc("fail_discovery_turn", {
        target_session_id: sessionId,
        target_turn_id: turnId,
        target_agent_run_id: runId ?? null,
        target_failure_code: failureCode,
      });
    }

    logOperationalEvent({
      level: "error",
      event: "discovery.turn.failed",
      correlationId,
      projectId: input.projectId,
      runId,
      userId: input.userId,
      durationMs: latencyMs,
      metadata: {
        failureCode,
        turnId,
        errorMessage: message,
      },
    });

    return { ok: false, error: getAiRuntimeErrorMessage(message) };
  }
}
