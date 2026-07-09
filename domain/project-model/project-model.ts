export type ProjectModelStatus =
  | "draft"
  | "generated"
  | "review_required"
  | "approved";

export type ConfirmationStatus =
  | "confirmed"
  | "assumed"
  | "proposed"
  | "unresolved"
  | "rejected";

export type RequirementType =
  | "functional"
  | "non_functional"
  | "security"
  | "operational"
  | "integration"
  | "reporting";

export type ProjectRequirement = {
  id: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: "must" | "should" | "could";
  status: ConfirmationStatus;
  sourceQuestionId?: string;
};

export type ProjectAssumption = {
  id: string;
  statement: string;
  impact: "low" | "medium" | "high";
  status: ConfirmationStatus;
  sourceQuestionId?: string;
};

export type ProjectDomainEntity = {
  id: string;
  name: string;
  description: string;
  status: ConfirmationStatus;
  sourceQuestionId?: string;
};

export type ProjectRisk = {
  id: string;
  title: string;
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
};

export type ProjectOpenQuestion = {
  id: string;
  question: string;
  reason: string;
  priority: "low" | "medium" | "high";
};

export type ProjectModel = {
  projectId: string;
  status: ProjectModelStatus;
  requirements: ProjectRequirement[];
  assumptions: ProjectAssumption[];
  domainEntities: ProjectDomainEntity[];
  risks: ProjectRisk[];
  openQuestions: ProjectOpenQuestion[];
  generatedAt: string;
  updatedAt: string;
};
