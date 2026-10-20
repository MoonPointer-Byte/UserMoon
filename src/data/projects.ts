import catalog from "../../shared/catalog.json";

export type Project = (typeof catalog)[number];

export const PROJECTS: Project[] = catalog;

export function findProject(id: string | null) {
  if (!id) return null;
  return PROJECTS.find((item) => item.id === id) ?? null;
}
