export type ProjectStatus =
  | "draft"
  | "interviewing"
  | "ready_for_review"
  | "package_generated"
  | "exported"
  | "archived";

export type ProductType =
  | "web_app"
  | "mobile_app"
  | "saas"
  | "internal_system"
  | "marketplace"
  | "ecommerce"
  | "ai_tool"
  | "other";

export type TechnicalLevel =
  | "non_technical"
  | "beginner"
  | "intermediate"
  | "advanced";

export type FoundationProject = {
  id: string;
  name: string;
  description: string;
  industry: string;
  productType: ProductType;
  technicalLevel: TechnicalLevel;
  mainGoal: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};
