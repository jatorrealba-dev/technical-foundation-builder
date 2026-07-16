import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);

const prioritySchema = z.enum([
  "low",
  "medium",
  "high",
]);

const severitySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

const confirmationStatusSchema = z.enum([
  "confirmed",
  "assumed",
  "proposed",
  "unresolved",
  "rejected",
]);

export const interviewAgentOutputSchema = z.object({
  summary: z.string(),
  nextQuestions: z
    .array(
      z.object({
        id: z.string(),
        stage: z.enum([
          "idea",
          "product",
          "users",
          "domain",
          "workflow",
          "data",
          "security",
          "architecture",
          "operations",
          "delivery",
        ]),
        question: z.string(),
        helperText: z.string(),
        reason: z.string(),
        priority: prioritySchema,
        affectsArtifacts: z.array(
          z.enum([
            "product_spec",
            "mvp_scope",
            "domain_model",
            "architecture",
            "data_model",
            "security",
            "backlog",
            "vertical_slice_plan",
          ])
        ),
        riskArea: z.string().nullable(),
        required: z.boolean(),
      })
    )
    .max(8),
  missingInformation: z.array(z.string()),
  contradictions: z.array(z.string()),
  recommendation: z.enum([
    "continue_interview",
    "ready_for_model",
    "requires_human_review",
  ]),
  confidence: confidenceSchema,
});

export const projectModelAgentOutputSchema = z.object({
  summary: z.string(),
  requirements: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum([
        "functional",
        "non_functional",
        "security",
        "operational",
        "integration",
        "reporting",
      ]),
      priority: z.enum(["must", "should", "could"]),
      status: confirmationStatusSchema,
      evidence: z.array(z.string()),
    })
  ),
  assumptions: z.array(
    z.object({
      id: z.string(),
      statement: z.string(),
      impact: z.enum(["low", "medium", "high"]),
      status: confirmationStatusSchema,
      evidence: z.array(z.string()),
    })
  ),
  domainEntities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      status: confirmationStatusSchema,
      evidence: z.array(z.string()),
    })
  ),
  risks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      probability: z.enum(["low", "medium", "high"]),
      impact: z.enum(["low", "medium", "high"]),
      mitigation: z.string(),
    })
  ),
  openQuestions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      reason: z.string(),
      priority: prioritySchema,
    })
  ),
  confidence: confidenceSchema,
});

export const architectureAgentOutputSchema = z.object({
  summary: z.string(),
  recommendedStyle: z.string(),
  components: z.array(
    z.object({
      name: z.string(),
      responsibility: z.string(),
      boundaries: z.array(z.string()),
      dependencies: z.array(z.string()),
    })
  ),
  decisions: z.array(
    z.object({
      title: z.string(),
      decision: z.string(),
      rationale: z.string(),
      alternatives: z.array(z.string()),
      consequences: z.array(z.string()),
      status: z.enum([
        "proposed",
        "requires_review",
        "accepted",
      ]),
    })
  ),
  integrationContracts: z.array(
    z.object({
      integration: z.string(),
      direction: z.string(),
      contract: z.string(),
      failureStrategy: z.string(),
    })
  ),
  risks: z.array(
    z.object({
      severity: severitySchema,
      risk: z.string(),
      mitigation: z.string(),
    })
  ),
  openQuestions: z.array(z.string()),
  confidence: confidenceSchema,
});

export const securityAgentOutputSchema = z.object({
  summary: z.string(),
  dataClassification: z.array(
    z.object({
      data: z.string(),
      classification: z.enum([
        "public",
        "internal",
        "confidential",
        "restricted",
      ]),
      rationale: z.string(),
    })
  ),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: severitySchema,
      category: z.string(),
      finding: z.string(),
      evidence: z.array(z.string()),
      recommendation: z.string(),
    })
  ),
  requiredControls: z.array(
    z.object({
      control: z.string(),
      objective: z.string(),
      verification: z.string(),
      priority: prioritySchema,
    })
  ),
  residualRisks: z.array(z.string()),
  confidence: confidenceSchema,
});

export const consistencyAgentOutputSchema = z.object({
  summary: z.string(),
  issues: z.array(
    z.object({
      id: z.string(),
      severity: severitySchema,
      category: z.enum([
        "requirement_gap",
        "domain_gap",
        "data_gap",
        "security_gap",
        "architecture_gap",
        "delivery_gap",
        "contradiction",
        "stale_artifact",
      ]),
      description: z.string(),
      evidence: z.array(z.string()),
      affectedArtifacts: z.array(z.string()),
      recommendation: z.string(),
    })
  ),
  passedChecks: z.array(z.string()),
  requiresHumanReview: z.boolean(),
  confidence: confidenceSchema,
});

export const readinessAgentOutputSchema = z.object({
  summary: z.string(),
  overallScore: z.number().int().min(0).max(100),
  dimensions: z.array(
    z.object({
      key: z.enum([
        "product",
        "domain",
        "architecture",
        "data",
        "security",
        "testing",
        "delivery",
        "operations",
      ]),
      score: z.number().int().min(0).max(100),
      rationale: z.string(),
      evidence: z.array(z.string()),
      gaps: z.array(z.string()),
    })
  ),
  blockers: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
      priority: prioritySchema,
    })
  ),
  nextActions: z.array(
    z.object({
      action: z.string(),
      ownerRole: z.string(),
      expectedOutcome: z.string(),
      priority: prioritySchema,
    })
  ),
  confidence: confidenceSchema,
});

export type InterviewAgentOutput = z.infer<
  typeof interviewAgentOutputSchema
>;

export type ProjectModelAgentOutput = z.infer<
  typeof projectModelAgentOutputSchema
>;

export type ArchitectureAgentOutput = z.infer<
  typeof architectureAgentOutputSchema
>;

export type SecurityAgentOutput = z.infer<
  typeof securityAgentOutputSchema
>;

export type ConsistencyAgentOutput = z.infer<
  typeof consistencyAgentOutputSchema
>;

export type ReadinessAgentOutput = z.infer<
  typeof readinessAgentOutputSchema
>;
