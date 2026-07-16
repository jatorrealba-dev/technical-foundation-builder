import "server-only";

export type OperationalLogLevel =
  | "info"
  | "warn"
  | "error";

type OperationalLogInput = {
  level: OperationalLogLevel;
  event: string;
  correlationId?: string;
  organizationId?: string;
  projectId?: string;
  runId?: string;
  userId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export function logOperationalEvent(
  input: OperationalLogInput
): void {
  const record = {
    timestamp: new Date().toISOString(),
    level: input.level,
    event: input.event,
    correlationId: input.correlationId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId: input.runId,
    userId: input.userId,
    durationMs: input.durationMs,
    metadata: input.metadata,
  };

  const line = JSON.stringify(record);

  if (input.level === "error") {
    console.error(line);
    return;
  }

  if (input.level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
