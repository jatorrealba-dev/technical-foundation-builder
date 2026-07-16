import { createHash } from "node:crypto";

export function normalizeReadinessText(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createReadinessFingerprint(
  ...parts: Array<string | string[]>
): string {
  const normalized = parts
    .flatMap((part) =>
      Array.isArray(part)
        ? [...part].sort().map(normalizeReadinessText)
        : [normalizeReadinessText(part)]
    )
    .join("|");

  return createHash("sha256")
    .update(normalized)
    .digest("hex");
}
