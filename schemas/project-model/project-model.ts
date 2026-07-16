import { z } from "zod";

const confirmationStatusSchema = z.enum([
  "confirmed",
  "assumed",
  "proposed",
  "unresolved",
  "rejected",
]);

const requirementSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  description: z.string().min(1).max(6000),
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
  sourceQuestionId: z.string().max(160).optional(),
});

const assumptionSchema = z.object({
  id: z.string().min(1).max(160),
  statement: z.string().min(1).max(6000),
  impact: z.enum(["low", "medium", "high"]),
  status: confirmationStatusSchema,
  sourceQuestionId: z.string().max(160).optional(),
});

const domainEntitySchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(240),
  description: z.string().min(1).max(6000),
  status: confirmationStatusSchema,
  sourceQuestionId: z.string().max(160).optional(),
});

const riskSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  description: z.string().min(1).max(6000),
  probability: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  mitigation: z.string().min(1).max(6000),
});

const openQuestionSchema = z.object({
  id: z.string().min(1).max(160),
  question: z.string().min(1).max(2000),
  reason: z.string().min(1).max(4000),
  priority: z.enum(["low", "medium", "high"]),
});

export const editableProjectModelSchema = z.object({
  status: z.enum([
    "draft",
    "generated",
    "review_required",
    "approved",
  ]),
  requirements: z.array(requirementSchema).max(250),
  assumptions: z.array(assumptionSchema).max(250),
  domainEntities: z.array(domainEntitySchema).max(250),
  risks: z.array(riskSchema).max(250),
  openQuestions: z.array(openQuestionSchema).max(250),
});

export type EditableProjectModelInput = z.infer<
  typeof editableProjectModelSchema
>;
