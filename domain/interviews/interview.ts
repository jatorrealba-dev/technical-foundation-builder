export type InterviewStage =
  | "idea"
  | "product"
  | "users"
  | "domain"
  | "security"
  | "architecture"
  | "delivery";

export type InterviewQuestion = {
  id: string;
  stage: InterviewStage;
  question: string;
  helperText: string;
  priority: number;
};

export type InterviewAnswer = {
  questionId: string;
  answer: string;
  answeredAt: string;
};

export type ProjectInterview = {
  projectId: string;
  status: "not_started" | "in_progress" | "completed";
  currentStage: InterviewStage;
  answers: InterviewAnswer[];
  createdAt: string;
  updatedAt: string;
};

export const initialInterviewQuestions: InterviewQuestion[] = [
  {
    id: "idea-001",
    stage: "idea",
    question: "¿Qué quieres construir exactamente?",
    helperText:
      "Descríbelo como si se lo explicaras a un desarrollador que no conoce tu idea.",
    priority: 1,
  },
  {
    id: "product-001",
    stage: "product",
    question: "¿Qué problema principal resuelve este producto?",
    helperText:
      "Evita describir solo funcionalidades. Explica el dolor o necesidad real.",
    priority: 2,
  },
  {
    id: "users-001",
    stage: "users",
    question: "¿Quiénes serán los usuarios principales?",
    helperText:
      "Incluye usuarios finales, administradores, operadores, clientes o equipos internos.",
    priority: 3,
  },
  {
    id: "domain-001",
    stage: "domain",
    question: "¿Cuáles son las entidades principales del negocio?",
    helperText:
      "Ejemplo: usuario, proyecto, ticket, empleado, pago, locación, documento, etc.",
    priority: 4,
  },
  {
    id: "security-001",
    stage: "security",
    question: "¿Qué información debe protegerse especialmente?",
    helperText:
      "Piensa en datos privados, información financiera, documentos sensibles, credenciales o permisos.",
    priority: 5,
  },
  {
    id: "architecture-001",
    stage: "architecture",
    question: "¿El sistema debe ser web, móvil, interno, SaaS o una combinación?",
    helperText:
      "También indica si debe funcionar para varias empresas, equipos o clientes.",
    priority: 6,
  },
  {
    id: "delivery-001",
    stage: "delivery",
    question: "¿Cuál sería la primera versión útil del producto?",
    helperText:
      "Describe el MVP: lo mínimo que debe existir para que el producto ya entregue valor.",
    priority: 7,
  },
];
