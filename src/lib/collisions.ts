/**
 * The path collision check (#3). A project site of the owner is served at
 * `/<repository>/` on the same domain as this user site, so no top-level
 * output name may match, case-insensitively, a repository with Pages enabled.
 */

export interface Repository {
  name: string;
  has_pages: boolean;
}

export interface Collision {
  /** The top-level name in the build output. */
  output: string;
  /** The Pages-enabled repository it matches, as GitHub writes it. */
  repository: string;
}

export function findCollisions(
  outputNames: readonly string[],
  repositories: readonly Repository[],
  owner: string,
): Collision[] {
  const userSite = `${owner}.github.io`.toLowerCase();
  const projectSites = new Map<string, string>();
  for (const repo of repositories) {
    const key = repo.name.toLowerCase();
    if (repo.has_pages && key !== userSite) projectSites.set(key, repo.name);
  }
  return outputNames.flatMap((output) => {
    const repository = projectSites.get(output.toLowerCase());
    return repository ? [{ output, repository }] : [];
  });
}
