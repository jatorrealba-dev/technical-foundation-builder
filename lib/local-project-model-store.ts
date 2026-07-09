import { ProjectInterview } from "@/domain/interviews/interview";
import {
  ProjectAssumption,
  ProjectDomainEntity,
  ProjectModel,
  ProjectOpenQuestion,
  ProjectRequirement,
  ProjectRisk,
} from "@/domain/project-model/project-model";
import { getProjectInterview } from "@/lib/local-interview-store";

const STORAGE_KEY = "technical-foundation-builder.project-models";

function isBrowser() {
  return typeof window !== "undefined";
}

function getAllProjectModels(): ProjectModel[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as ProjectModel[];
  } catch {
    return [];
  }
}

function saveAllProjectModels(models: ProjectModel[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

export function getProjectModel(projectId: string): ProjectModel | null {
  return (
    getAllProjectModels().find((model) => model.projectId === projectId) ??
    null
  );
}

export function saveProjectModel(model: ProjectModel): ProjectModel {
  const models = getAllProjectModels();

  const nextModels = [
    model,
    ...models.filter((existingModel) => existingModel.projectId !== model.projectId),
  ];

  saveAllProjectModels(nextModels);

  return model;
}

function getAnswer(interview: ProjectInterview, questionId: string): string {
  return (
    interview.answers.find((answer) => answer.questionId === questionId)
      ?.answer ?? ""
  ).trim();
}

function splitPossibleEntities(raw: string): string[] {
  return raw
    .split(/,|\.|\n|;| y | e /gi)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 10);
}

function buildRequirements(interview: ProjectInterview): ProjectRequirement[] {
  const idea = getAnswer(interview, "idea-001");
  const problem = getAnswer(interview, "product-001");
  const users = getAnswer(interview, "users-001");
  const architecture = getAnswer(interview, "architecture-001");
  const delivery = getAnswer(interview, "delivery-001");

  const requirements: ProjectRequirement[] = [];

  if (idea) {
    requirements.push({
      id: "req-idea-core",
      title: "Definir la capacidad central del producto",
      description: idea,
      type: "functional",
      priority: "must",
      status: "confirmed",
      sourceQuestionId: "idea-001",
    });
  }

  if (problem) {
    requirements.push({
      id: "req-problem-solved",
      title: "Resolver el problema principal identificado",
      description: problem,
      type: "functional",
      priority: "must",
      status: "confirmed",
      sourceQuestionId: "product-001",
    });
  }

  if (users) {
    requirements.push({
      id: "req-user-roles",
      title: "Soportar los usuarios principales del sistema",
      description: users,
      type: "functional",
      priority: "must",
      status: "confirmed",
      sourceQuestionId: "users-001",
    });
  }

  if (architecture) {
    requirements.push({
      id: "req-platform-target",
      title: "Definir plataforma y modalidad del sistema",
      description: architecture,
      type: "non_functional",
      priority: "must",
      status: "confirmed",
      sourceQuestionId: "architecture-001",
    });
  }

  if (delivery) {
    requirements.push({
      id: "req-mvp-scope",
      title: "Construir una primera versión útil",
      description: delivery,
      type: "operational",
      priority: "must",
      status: "confirmed",
      sourceQuestionId: "delivery-001",
    });
  }

  return requirements;
}

function buildDomainEntities(interview: ProjectInterview): ProjectDomainEntity[] {
  const rawEntities = getAnswer(interview, "domain-001");
  const possibleEntities = splitPossibleEntities(rawEntities);

  return possibleEntities.map((entity, index) => ({
    id: `entity-${index + 1}`,
    name: entity,
    description:
      "Entidad detectada desde la respuesta inicial del usuario. Requiere refinamiento posterior.",
    status: "proposed",
    sourceQuestionId: "domain-001",
  }));
}

function buildAssumptions(interview: ProjectInterview): ProjectAssumption[] {
  const assumptions: ProjectAssumption[] = [];

  const security = getAnswer(interview, "security-001");
  const architecture = getAnswer(interview, "architecture-001");
  const users = getAnswer(interview, "users-001");

  if (!security) {
    assumptions.push({
      id: "assumption-security-missing",
      statement:
        "Todavía no está definida la información sensible que el sistema debe proteger.",
      impact: "high",
      status: "unresolved",
      sourceQuestionId: "security-001",
    });
  }

  if (architecture.toLowerCase().includes("saas")) {
    assumptions.push({
      id: "assumption-multitenant",
      statement:
        "El producto probablemente necesita arquitectura multi-tenant porque fue descrito como SaaS.",
      impact: "high",
      status: "assumed",
      sourceQuestionId: "architecture-001",
    });
  }

  if (users && !users.toLowerCase().includes("admin")) {
    assumptions.push({
      id: "assumption-admin-role",
      statement:
        "Puede existir al menos un rol administrativo aunque todavía no haya sido descrito explícitamente.",
      impact: "medium",
      status: "assumed",
      sourceQuestionId: "users-001",
    });
  }

  return assumptions;
}

function buildRisks(interview: ProjectInterview): ProjectRisk[] {
  const risks: ProjectRisk[] = [];

  const architecture = getAnswer(interview, "architecture-001");
  const security = getAnswer(interview, "security-001");
  const delivery = getAnswer(interview, "delivery-001");

  if (architecture.toLowerCase().includes("saas")) {
    risks.push({
      id: "risk-tenant-isolation",
      title: "Aislamiento insuficiente entre clientes",
      description:
        "Si el producto es SaaS, la arquitectura debe impedir acceso cruzado entre organizaciones o clientes.",
      probability: "medium",
      impact: "high",
      mitigation:
        "Definir desde el inicio organizationId/projectId, políticas de autorización y pruebas de aislamiento.",
    });
  }

  if (!security) {
    risks.push({
      id: "risk-security-undefined",
      title: "Seguridad no definida",
      description:
        "La falta de definición de datos sensibles puede llevar a permisos incorrectos o exposición de información.",
      probability: "medium",
      impact: "high",
      mitigation:
        "Completar entrevista de seguridad antes de generar arquitectura final.",
    });
  }

  if (!delivery) {
    risks.push({
      id: "risk-mvp-undefined",
      title: "MVP no delimitado",
      description:
        "Si la primera versión útil no está clara, el alcance puede crecer sin control.",
      probability: "high",
      impact: "medium",
      mitigation:
        "Definir explícitamente qué entra y qué queda fuera del MVP.",
    });
  }

  return risks;
}

function buildOpenQuestions(interview: ProjectInterview): ProjectOpenQuestion[] {
  const openQuestions: ProjectOpenQuestion[] = [];

  const requiredQuestions = [
    {
      id: "idea-001",
      question: "¿Qué quieres construir exactamente?",
      reason: "Sin esta respuesta no se puede generar un Product Spec útil.",
      priority: "high" as const,
    },
    {
      id: "product-001",
      question: "¿Qué problema principal resuelve este producto?",
      reason: "El problema define la propuesta de valor y el alcance.",
      priority: "high" as const,
    },
    {
      id: "users-001",
      question: "¿Quiénes serán los usuarios principales?",
      reason: "Los usuarios determinan roles, permisos y flujos.",
      priority: "high" as const,
    },
    {
      id: "security-001",
      question: "¿Qué información debe protegerse especialmente?",
      reason: "La seguridad debe definirse antes de decidir arquitectura final.",
      priority: "high" as const,
    },
    {
      id: "delivery-001",
      question: "¿Cuál sería la primera versión útil del producto?",
      reason: "El MVP evita sobrealcance y permite construir por etapas.",
      priority: "high" as const,
    },
  ];

  for (const item of requiredQuestions) {
    if (!getAnswer(interview, item.id)) {
      openQuestions.push({
        id: `open-${item.id}`,
        question: item.question,
        reason: item.reason,
        priority: item.priority,
      });
    }
  }

  return openQuestions;
}

export function generateLocalProjectModel(projectId: string): ProjectModel {
  const interview = getProjectInterview(projectId);
  const now = new Date().toISOString();

  const model: ProjectModel = {
    projectId,
    status: "generated",
    requirements: buildRequirements(interview),
    assumptions: buildAssumptions(interview),
    domainEntities: buildDomainEntities(interview),
    risks: buildRisks(interview),
    openQuestions: buildOpenQuestions(interview),
    generatedAt: now,
    updatedAt: now,
  };

  return saveProjectModel(model);
}
