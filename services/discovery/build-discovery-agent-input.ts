import type { DiscoveryRuntimeContext } from "./discovery-runtime-context";

export type DiscoveryTurnMode =
  | "normal"
  | "blockers_only"
  | "human_review_required";

export function buildDiscoveryAgentInput(input: {
  context: DiscoveryRuntimeContext;
  turnId: string;
  userMessageId: string;
  turnMode: DiscoveryTurnMode;
}): string {
  return JSON.stringify(
    {
      contract: "discovery.v2",
      turn: {
        id: input.turnId,
        userMessageId: input.userMessageId,
        mode: input.turnMode,
      },
      instruction:
        "Razona internamente con rigor técnico, pero formula la respuesta y la siguiente pregunta en lenguaje claro para una persona no técnica. No preguntes por tecnologías; pregunta por situaciones, actores, decisiones, consecuencias y expectativas observables.",
      context: input.context,
    },
    null,
    2
  );
}
