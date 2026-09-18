export function generateRepoName(businessName: string | null | undefined, projectId: string): string {
  const projectNameSlug = businessName
    ? businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : `project-${projectId.substring(0, 8)}`;
    
  return `${projectNameSlug}-${projectId.substring(0, 4)}`;
}
