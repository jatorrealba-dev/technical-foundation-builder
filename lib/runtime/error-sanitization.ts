import "server-only";

const secretPatterns = [
  /sk-[a-zA-Z0-9_-]{12,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /OPENAI_API_KEY\s*[=:]\s*\S+/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*\S+/gi,
];

export function sanitizeOperationalError(
  value: unknown,
  fallback = "Ocurrió un error operativo inesperado."
): string {
  const raw = value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : fallback;

  let sanitized = raw;

  for (const pattern of secretPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized.trim().slice(0, 1_000) || fallback;
}
