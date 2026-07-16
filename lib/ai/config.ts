import "server-only";

export type AiRuntimeConfiguration = {
  enabled: boolean;
  apiKey: string;
  model: string;
  tracingEnabled: boolean;
  maxTurns: number;
};

export type AiConfigurationStatus = {
  enabled: boolean;
  hasApiKey: boolean;
  hasModel: boolean;
  model: string | null;
  tracingEnabled: boolean;
  maxTurns: number;
  ready: boolean;
};

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function getAiConfigurationStatus(): AiConfigurationStatus {
  const enabled = isEnabled(
    process.env.AI_AGENTS_ENABLED
  );

  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ?? "";

  const model =
    process.env.OPENAI_AGENT_MODEL?.trim() ?? "";

  const tracingEnabled = isEnabled(
    process.env.OPENAI_AGENTS_TRACING_ENABLED
  );

  const maxTurns = parseBoundedInteger(
    process.env.AI_AGENT_MAX_TURNS,
    3,
    1,
    10
  );

  return {
    enabled,
    hasApiKey: apiKey.length > 0,
    hasModel: model.length > 0,
    model: model || null,
    tracingEnabled,
    maxTurns,
    ready:
      enabled &&
      apiKey.length > 0 &&
      model.length > 0,
  };
}

export function requireAiRuntimeConfiguration(): AiRuntimeConfiguration {
  const status = getAiConfigurationStatus();

  if (!status.enabled) {
    throw new Error(
      "Los agentes de IA están deshabilitados. Define AI_AGENTS_ENABLED=true."
    );
  }

  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ?? "";

  if (!apiKey) {
    throw new Error(
      "Falta OPENAI_API_KEY en el entorno del servidor."
    );
  }

  const model =
    process.env.OPENAI_AGENT_MODEL?.trim() ?? "";

  if (!model) {
    throw new Error(
      "Falta OPENAI_AGENT_MODEL en el entorno del servidor."
    );
  }

  return {
    enabled: true,
    apiKey,
    model,
    tracingEnabled: status.tracingEnabled,
    maxTurns: status.maxTurns,
  };
}
