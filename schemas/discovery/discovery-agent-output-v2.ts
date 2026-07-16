import { z } from "zod";

import {
  discoveryV2ArtifactReadinessStatuses,
  discoveryV2ArtifactTypes,
  discoveryV2CoverageKeys,
  discoveryV2CoverageStatuses,
  discoveryV2IssueSeverities,
  discoveryV2KnowledgeTypes,
  discoveryV2KnowledgeValidationStatuses,
  validateDiscoveryV2CoverageAssessment,
} from "../../domain/discovery/discovery-v2.ts";

const confidenceSchema = z.number().min(0).max(1);
const nonEmptyStringArraySchema = z.array(z.string().trim().min(1));

const coverageKeySchema = z.enum(discoveryV2CoverageKeys);
const coverageStatusSchema = z.enum(discoveryV2CoverageStatuses);
const artifactTypeSchema = z.enum(discoveryV2ArtifactTypes);
const artifactReadinessStatusSchema = z.enum(
  discoveryV2ArtifactReadinessStatuses
);
const issueSeveritySchema = z.enum(discoveryV2IssueSeverities);

const coverageAssessmentSchema = z
  .object({
    dimension: coverageKeySchema,
    status: coverageStatusSchema,
    satisfiedCriteria: z.array(z.string().trim().min(1)),
    missingCriteria: z.array(z.string().trim().min(1)),
    notApplicableCriteria: z.array(
      z.object({
        key: z.string().trim().min(1),
        reason: z.string().trim().min(1).max(1000),
      })
    ),
    evidence: z.array(
      z.object({
        criterionKey: z.string().trim().min(1),
        statement: z.string().trim().min(1).max(1200),
        sourceMessageIds: nonEmptyStringArraySchema.min(1).max(12),
      })
    ),
    rationale: z.string().trim().min(1).max(1200),
    confidence: confidenceSchema,
  })
  .superRefine((assessment, context) => {
    for (const error of validateDiscoveryV2CoverageAssessment(assessment)) {
      context.addIssue({
        code: "custom",
        message: error,
      });
    }
  });

const artifactReadinessSchema = z.object({
  artifact: artifactTypeSchema,
  status: artifactReadinessStatusSchema,
  blockers: z.array(z.string().trim().min(1).max(1000)).max(20),
  rationale: z.string().trim().min(1).max(1200),
});

export const discoveryAgentOutputV2Schema = z
  .object({
    promptVersion: z.literal("discovery.v2"),
    assistantMessage: z.string().trim().min(1).max(4000),
    understandingSummary: z.string().trim().min(1).max(6000),
    extractedKnowledge: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(120),
          type: z.enum(discoveryV2KnowledgeTypes),
          dimension: coverageKeySchema,
          statement: z.string().trim().min(1).max(1200),
          confidence: confidenceSchema,
          validationStatus: z.enum(
            discoveryV2KnowledgeValidationStatuses
          ),
          sourceMessageIds: nonEmptyStringArraySchema.min(1).max(12),
        })
      )
      .max(20),
    gaps: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(120),
          dimension: coverageKeySchema,
          description: z.string().trim().min(1).max(1200),
          severity: issueSeveritySchema,
          affectedArtifacts: z.array(artifactTypeSchema).min(1).max(8),
          evidenceMessageIds: nonEmptyStringArraySchema.max(12),
        })
      )
      .max(20),
    contradictions: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(120),
          dimension: coverageKeySchema,
          statementA: z.string().trim().min(1).max(1200),
          statementB: z.string().trim().min(1).max(1200),
          sourceMessageA: z.string().trim().min(1),
          sourceMessageB: z.string().trim().min(1),
          severity: issueSeveritySchema,
          resolutionQuestion: z.string().trim().min(1).max(1200),
          affectedArtifacts: z.array(artifactTypeSchema).min(1).max(8),
        })
      )
      .max(12),
    coverage: z.array(coverageAssessmentSchema).length(13),
    artifactReadiness: z.array(artifactReadinessSchema).length(8),
    nextQuestion: z
      .object({
        text: z.string().trim().min(1).max(1200),
        reason: z.string().trim().min(1).max(1200),
        dimension: coverageKeySchema,
        priority: z.enum(["low", "medium", "high", "critical"]),
        affectedArtifacts: z.array(artifactTypeSchema).min(1).max(8),
        priorityFactors: z.object({
          businessImpact: z.number().min(0).max(5),
          architectureImpact: z.number().min(0).max(5),
          securityImpact: z.number().min(0).max(5),
          dependencyImpact: z.number().min(0).max(5),
          uncertainty: z.number().min(0).max(5),
          documentBlocker: z.number().min(0).max(5),
          redundancy: z.number().min(0).max(5),
          userFatigue: z.number().min(0).max(5),
        }),
      })
      .nullable(),
    completionAssessment: z.object({
      recommendation: z.enum([
        "continue",
        "ready_for_review",
        "complete",
        "complete_with_open_items",
        "human_review_required",
      ]),
      reason: z.string().trim().min(1).max(1200),
      eligibleForReview: z.boolean(),
      eligibleForCompletion: z.boolean(),
      eligibleForCompletionWithOpenItems: z.boolean(),
    }),
    confidence: confidenceSchema,
  })
  .superRefine((output, context) => {
    const coverageDimensions = output.coverage.map(
      (assessment) => assessment.dimension
    );
    const artifactTypes = output.artifactReadiness.map(
      (readiness) => readiness.artifact
    );

    if (new Set(coverageDimensions).size !== discoveryV2CoverageKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message:
          "La salida debe contener exactamente una evaluación por dimensión.",
      });
    }

    for (const dimension of discoveryV2CoverageKeys) {
      if (!coverageDimensions.includes(dimension)) {
        context.addIssue({
          code: "custom",
          path: ["coverage"],
          message: `Falta la dimensión ${dimension}.`,
        });
      }
    }

    if (new Set(artifactTypes).size !== discoveryV2ArtifactTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["artifactReadiness"],
        message:
          "La salida debe contener exactamente una evaluación por documento.",
      });
    }

    for (const artifact of discoveryV2ArtifactTypes) {
      if (!artifactTypes.includes(artifact)) {
        context.addIssue({
          code: "custom",
          path: ["artifactReadiness"],
          message: `Falta el documento ${artifact}.`,
        });
      }
    }

    if (
      output.completionAssessment.recommendation === "continue" &&
      output.nextQuestion === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["nextQuestion"],
        message:
          "La recomendación continue requiere una siguiente pregunta.",
      });
    }

    if (
      output.completionAssessment.recommendation === "complete" &&
      output.nextQuestion !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["nextQuestion"],
        message:
          "Una entrevista completa no debe proponer otra pregunta.",
      });
    }
  });

export type DiscoveryAgentOutputV2 = z.infer<
  typeof discoveryAgentOutputV2Schema
>;
