import type { ArtifactType } from "./artifact";

export type ArtifactCatalogItem = {
  type: ArtifactType;
  title: string;
  filename: string;
  description: string;
};

export const artifactCatalog: readonly ArtifactCatalogItem[] = [
  {
    type: "product_spec",
    title: "Product Spec",
    filename: "PRODUCT_SPEC.md",
    description:
      "Describe el producto, sus requisitos, entidades, supuestos, riesgos y preguntas abiertas.",
  },
  {
    type: "mvp_scope",
    title: "MVP Scope",
    filename: "MVP_SCOPE.md",
    description:
      "Delimita la primera versión útil, el alcance incluido, los criterios de aceptación y los bloqueadores.",
  },
  {
    type: "domain_model",
    title: "Domain Model",
    filename: "DOMAIN_MODEL.md",
    description:
      "Documenta el lenguaje ubicuo, las entidades detectadas, capacidades, límites candidatos, relaciones pendientes y reglas del dominio.",
  },
  {
    type: "architecture",
    title: "Software Architecture",
    filename: "ARCHITECTURE.md",
    description:
      "Propone el estilo arquitectónico, las capas, módulos candidatos, responsabilidades de datos, seguridad, integraciones y estrategia de evolución.",
  },
  {
    type: "data_model",
    title: "Data Model",
    filename: "DATA_MODEL.md",
    description:
      "Propone entidades persistentes, tablas candidatas, relaciones pendientes, restricciones de integridad, tenancy, índices y estrategia de migraciones.",
  },
  {
    type: "security",
    title: "Security",
    filename: "SECURITY.md",
    description:
      "Define requisitos detectados, autenticación, autorización, clasificación de datos, amenazas, controles, auditoría, privacidad y pruebas de seguridad.",
  },
  {
    type: "backlog",
    title: "Product and Technical Backlog",
    filename: "BACKLOG.md",
    description:
      "Convierte requisitos, entidades, riesgos, supuestos y preguntas abiertas en trabajo priorizado, trazable y verificable.",
  },
  {
    type: "vertical_slice_plan",
    title: "Vertical Slice Plan",
    filename: "VERTICAL_SLICE_PLAN.md",
    description:
      "Define el primer flujo completo que atraviesa interfaz, aplicación, dominio, persistencia, seguridad, pruebas y despliegue.",
  },
];

export type RegisteredArtifact = ArtifactCatalogItem;

export const artifactTypes: readonly ArtifactType[] =
  artifactCatalog.map((artifact) => artifact.type);

export function isArtifactType(
  value: string
): value is ArtifactType {
  return artifactTypes.includes(value as ArtifactType);
}

export function getArtifactDefinition(
  type: ArtifactType
): RegisteredArtifact {
  const definition = artifactCatalog.find(
    (artifact) => artifact.type === type
  );

  if (!definition) {
    throw new Error(
      `No existe una definición registrada para el artefacto "${type}".`
    );
  }

  return definition;
}
