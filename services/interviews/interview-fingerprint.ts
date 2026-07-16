import type { InterviewStage } from "@/domain/interviews/interview";

export function normalizeInterviewText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createInterviewQuestionFingerprint(input: {
  stage: InterviewStage;
  question: string;
}): string {
  return `${input.stage}:${normalizeInterviewText(input.question)}`;
}

export function questionsAreSemanticallyEquivalent(
  left: string,
  right: string
): boolean {
  const normalizedLeft = normalizeInterviewText(left);
  const normalizedRight = normalizeInterviewText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftTerms = new Set(normalizedLeft.split(" "));
  const rightTerms = new Set(normalizedRight.split(" "));
  const intersection = [...leftTerms].filter((term) =>
    rightTerms.has(term)
  ).length;
  const union = new Set([...leftTerms, ...rightTerms]).size;

  return union > 0 && intersection / union >= 0.8;
}
