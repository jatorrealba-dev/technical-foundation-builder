import { createHash } from "node:crypto";

export function normalizeConsistencyText(
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

export function createConsistencyFingerprint(
  ...parts: Array<string | readonly string[]>
): string {
  const canonical = parts
    .flatMap((part) =>
      Array.isArray(part) ? [...part].sort() : [part]
    )
    .map((part) => normalizeConsistencyText(part))
    .join("|");

  return createHash("sha256")
    .update(canonical)
    .digest("hex");
}

export function contentIncludesReference(input: {
  content: string;
  id?: string;
  label: string;
}): boolean {
  const normalizedContent = normalizeConsistencyText(
    input.content
  );

  const normalizedId = input.id
    ? normalizeConsistencyText(input.id)
    : "";

  const normalizedLabel = normalizeConsistencyText(
    input.label
  );

  if (normalizedId && normalizedContent.includes(normalizedId)) {
    return true;
  }

  if (!normalizedLabel) {
    return false;
  }

  return normalizedContent.includes(normalizedLabel);
}
