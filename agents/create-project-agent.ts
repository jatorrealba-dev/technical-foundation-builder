import "server-only";

import { Agent } from "@openai/agents";

import type { AgentKey } from "@/domain/agents/agent";
import {
  architectureAgentOutputSchema,
  consistencyAgentOutputSchema,
  interviewAgentOutputSchema,
  projectModelAgentOutputSchema,
  readinessAgentOutputSchema,
  securityAgentOutputSchema,
} from "@/schemas/agents/agent-outputs";

import { getAgentInstructions } from "./prompts";
import { getAgentDefinition } from "./registry";

export function createProjectAgent(input: {
  key: AgentKey;
  model: string;
}) {
  const definition = getAgentDefinition(input.key);
  const common = {
    name: definition.name,
    instructions: getAgentInstructions(input.key),
    model: input.model,
  };

  switch (input.key) {
    case "interview":
      return new Agent({
        ...common,
        outputType: interviewAgentOutputSchema,
      });

    case "project_model":
      return new Agent({
        ...common,
        outputType: projectModelAgentOutputSchema,
      });

    case "architecture":
      return new Agent({
        ...common,
        outputType: architectureAgentOutputSchema,
      });

    case "security":
      return new Agent({
        ...common,
        outputType: securityAgentOutputSchema,
      });

    case "consistency":
      return new Agent({
        ...common,
        outputType: consistencyAgentOutputSchema,
      });

    case "readiness":
      return new Agent({
        ...common,
        outputType: readinessAgentOutputSchema,
      });
  }
}
