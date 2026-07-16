import type { ProjectModel } from "@/domain/project-model/project-model";
import type { ProjectModelAgentOutput } from "@/schemas/agents/agent-outputs";

export function normalizeAgentProjectModel(input: {
  projectId: string;
  output: ProjectModelAgentOutput;
  generatedAt?: string;
  updatedAt?: string;
}): ProjectModel {
  const now = new Date().toISOString();

  return {
    projectId: input.projectId,
    status: "approved",
    requirements: input.output.requirements.map(
      (requirement) => ({
        id: requirement.id,
        title: requirement.title,
        description: requirement.description,
        type: requirement.type,
        priority: requirement.priority,
        status: requirement.status,
      })
    ),
    assumptions: input.output.assumptions.map(
      (assumption) => ({
        id: assumption.id,
        statement: assumption.statement,
        impact: assumption.impact,
        status: assumption.status,
      })
    ),
    domainEntities: input.output.domainEntities.map(
      (entity) => ({
        id: entity.id,
        name: entity.name,
        description: entity.description,
        status: entity.status,
      })
    ),
    risks: input.output.risks,
    openQuestions: input.output.openQuestions,
    generatedAt: input.generatedAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
