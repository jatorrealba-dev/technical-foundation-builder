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

import { getDiscoveryV2AgentPrompt } from "@/agents/discovery-v2-prompt";
import { discoveryAgentOutputV2Schema } from "@/schemas/discovery/discovery-agent-output-v2";

import { getAgentInstructions } from "./prompts";
import { getAgentDefinition } from "./registry";

export function createProjectAgent(input: {
  key: AgentKey;
  model: string;
}) {
  const definition = getAgentDefinition(input.key);
  const common = {
    name: definition.name,
    instructions:
      input.key === "discovery"
        ? getDiscoveryV2AgentPrompt()
        : getAgentInstructions(input.key),
    model: input.model,
  };

  switch (input.key) {
    case "discovery":
      return new Agent({
        ...common,
        outputType: discoveryAgentOutputV2Schema,
      });

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
