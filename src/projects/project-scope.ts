export interface ProjectOwnedResource {
  projectId: string;
}

export function assertProjectOwnership(
  projectId: string,
  resource: ProjectOwnedResource,
  resourceLabel: string,
): void {
  if (resource.projectId !== projectId) {
    throw new Error(`${resourceLabel} does not belong to project ${projectId}.`);
  }
}

export function assertProjectCollection<T extends ProjectOwnedResource>(
  projectId: string,
  resources: T[],
  resourceLabel: string,
): void {
  for (const resource of resources) assertProjectOwnership(projectId, resource, resourceLabel);
}

export function scopeToProject<T extends ProjectOwnedResource>(projectId: string, resources: T[]): T[] {
  return resources.filter((resource) => resource.projectId === projectId);
}
