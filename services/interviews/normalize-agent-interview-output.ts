import type { ArtifactType } from "@/domain/artifacts/artifact";
import type { InterviewAgentOutput } from "@/schemas/agents/agent-outputs";

import type { ProposedInterviewQuestion } from "./generate-deterministic-interview-questions";
import { createInterviewQuestionFingerprint } from "./interview-fingerprint.ts";

const validArtifacts = new Set<ArtifactType>([
  "product_spec",
  "mvp_scope",
  "domain_model",
  "architecture",
  "data_model",
  "security",
  "backlog",
  "vertical_slice_plan",
]);

export function normalizeAgentInterviewQuestions(
  output: InterviewAgentOutput
): ProposedInterviewQuestion[] {
  return output.nextQuestions.map((question, index) => ({
    id: question.id.trim() || `agent-question-${index + 1}`,
    stage: question.stage,
    question: question.question.trim(),
    helperText: question.helperText.trim(),
    reason: question.reason.trim(),
    priority: question.priority,
    affectsArtifacts: question.affectsArtifacts.filter(
      (artifact): artifact is ArtifactType =>
        validArtifacts.has(artifact as ArtifactType)
    ),
    riskArea: question.riskArea?.trim() || null,
    required: question.required,
    fingerprint: createInterviewQuestionFingerprint({
      stage: question.stage,
      question: question.question,
    }),
  }));
}
