import { FoundationProject } from "@/domain/projects/project";

const STORAGE_KEY = "technical-foundation-builder.projects";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getLocalProjects(): FoundationProject[] {
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

    return parsed as FoundationProject[];
  } catch {
    return [];
  }
}

export function getLocalProjectById(
  projectId: string
): FoundationProject | null {
  return getLocalProjects().find((project) => project.id === projectId) ?? null;
}

export function saveLocalProject(
  project: FoundationProject
): FoundationProject {
  if (!isBrowser()) {
    return project;
  }

  const projects = getLocalProjects();
  const nextProjects = [
    project,
    ...projects.filter((existingProject) => existingProject.id !== project.id),
  ];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));

  return project;
}

export function createLocalProject(input: {
  name: string;
  description: string;
  industry: string;
  productType: FoundationProject["productType"];
  technicalLevel: FoundationProject["technicalLevel"];
  mainGoal: string;
}): FoundationProject {
  const now = new Date().toISOString();

  const project: FoundationProject = {
    id: `local-${Date.now()}`,
    name: input.name.trim(),
    description: input.description.trim(),
    industry: input.industry.trim(),
    productType: input.productType,
    technicalLevel: input.technicalLevel,
    mainGoal: input.mainGoal.trim(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return saveLocalProject(project);
}
