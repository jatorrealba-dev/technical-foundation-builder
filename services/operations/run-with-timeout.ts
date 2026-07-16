export class OperationTimeoutError extends Error {
  readonly code = "agent_run_timeout";

  constructor(timeoutSeconds: number) {
    super(
      `agent_run_timeout: la operación excedió ${timeoutSeconds} segundos.`
    );
    this.name = "OperationTimeoutError";
  }
}

export async function runWithTimeout<T>(
  operation: Promise<T>,
  timeoutSeconds: number
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new OperationTimeoutError(timeoutSeconds));
    }, timeoutSeconds * 1_000);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
