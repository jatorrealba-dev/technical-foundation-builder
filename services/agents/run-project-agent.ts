import "server-only";

import {
  run,
  setDefaultOpenAIKey,
  setTracingDisabled,
} from "@openai/agents";

import { createProjectAgent } from "@/agents/create-project-agent";
import { getAgentDefinition } from "@/agents/registry";
import type { AgentKey } from "@/domain/agents/agent";
import { requireAiRuntimeConfiguration } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";

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

type AgentRunInsertRow = {
  id: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error desconocido al ejecutar el agente.";
}

async function appendRunEvent(input: {
  supabase: ExecuteProjectAgentInput["supabase"];
  runId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await input.supabase
    .from("agent_run_events")
    .insert({
      run_id: input.runId,
      event_type: input.eventType,
      payload: input.payload ?? {},
    });

  if (error) {
    console.error(
      "No se pudo registrar un evento del agente.",
      error.message
    );
  }
}

export async function executeProjectAgent(
  input: ExecuteProjectAgentInput
): Promise<ExecuteProjectAgentResult> {
  let runId: string | undefined;
  const startedAt = new Date();

  try {
    const configuration =
      requireAiRuntimeConfiguration();

    const definition = getAgentDefinition(
      input.agentKey
    );

    const contextResult =
      await loadProjectAgentContext({
        supabase: input.supabase,
        projectId: input.projectId,
      });

    if (!contextResult.ok) {
      return contextResult;
    }

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

    const { data: runData, error: runInsertError } =
      await input.supabase
        .from("agent_runs")
        .insert({
          project_id: input.projectId,
          agent_key: input.agentKey,
          status: "running",
          provider: "openai",
          model: configuration.model,
          prompt_version:
            definition.promptVersion,
          input_snapshot: contextResult.context,
          created_by: input.userId,
          started_at: startedAt.toISOString(),
          updated_at: startedAt.toISOString(),
        })
        .select("id")
        .single();

    if (runInsertError) {
      return {
        ok: false,
        error: runInsertError.message,
      };
    }

    runId = (
      runData as unknown as AgentRunInsertRow
    ).id;

    await appendRunEvent({
      supabase: input.supabase,
      runId,
      eventType: "run_started",
      payload: {
        agentKey: input.agentKey,
        model: configuration.model,
        promptVersion:
          definition.promptVersion,
      },
    });

    setDefaultOpenAIKey(configuration.apiKey);
    setTracingDisabled(
      !configuration.tracingEnabled
    );

    const agent = createProjectAgent({
      key: input.agentKey,
      model: configuration.model,
    });

    const result = await run(
      agent,
      buildProjectAgentInput(
        contextResult.context
      ),
      {
        maxTurns: 3,
      }
    );

    if (result.finalOutput === undefined) {
      throw new Error(
        "El agente terminó sin producir una salida estructurada."
      );
    }

    const completedAt = new Date();
    const usage = result.state.usage;
    const latencyMs =
      completedAt.getTime() -
      startedAt.getTime();

    const { error: completionError } =
      await input.supabase
        .from("agent_runs")
        .update({
          status: "completed",
          output: result.finalOutput,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
          latency_ms: latencyMs,
          completed_at:
            completedAt.toISOString(),
          updated_at:
            completedAt.toISOString(),
        })
        .eq("id", runId);

    if (completionError) {
      throw new Error(
        `El agente respondió, pero no se pudo persistir el resultado: ${completionError.message}`
      );
    }

    await appendRunEvent({
      supabase: input.supabase,
      runId,
      eventType: "run_completed",
      payload: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        latencyMs,
      },
    });

    return {
      ok: true,
      runId,
      output: result.finalOutput,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    if (runId) {
      const completedAt = new Date();
      const latencyMs =
        completedAt.getTime() -
        startedAt.getTime();

      const { error: failureUpdateError } =
        await input.supabase
          .from("agent_runs")
          .update({
            status: "failed",
            error_message: message,
            latency_ms: latencyMs,
            completed_at:
              completedAt.toISOString(),
            updated_at:
              completedAt.toISOString(),
          })
          .eq("id", runId);

      if (failureUpdateError) {
        console.error(
          "No se pudo persistir el fallo del agente.",
          failureUpdateError.message
        );
      }

      await appendRunEvent({
        supabase: input.supabase,
        runId,
        eventType: "run_failed",
        payload: {
          error: message,
          latencyMs,
        },
      });
    }

    return {
      ok: false,
      error: message,
      runId,
    };
  }
}
