/**
 * Assembles the projects (#36) from the ordering file, the content files and
 * the GitHub facts, and enforces every build failure of the spec. Pure: no
 * files, no network.
 */
import type { RepositoryFacts } from "./github";
import { pickVersion, type Version } from "./releases";
import type { ContentFrontmatter } from "./schemas";

export interface Ordering {
  featured: string[];
  archive: string[];
}

/** What a project's `index.md` says: its frontmatter and its Markdown body. */
export type ContentFile = ContentFrontmatter & {
  /** The Markdown body of `index.md`. */
  body?: string;
};

export interface Project {
  /** The repository name, also the project's folder. */
  repository: string;
  featured: boolean;
  /** 1-based position inside its own list. */
  position: number;
  name: string;
  pitch: string;
  /** Featured projects only; empty for the archive. */
  proof: string[];
  body: string;
  live: string | null;
  repositoryUrl: string;
  language: string | null;
  version: Version | null;
}

export interface ProjectInput {
  ordering: Ordering;
  contents: ReadonlyMap<string, ContentFile>;
  /** `null` when the repository could not be returned. */
  facts: ReadonlyMap<string, RepositoryFacts | null>;
}

export class ProjectsError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `The projects are not valid:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`,
    );
    this.name = "ProjectsError";
  }
}

const FEATURED_MIN = 3;
const FEATURED_MAX = 6;
const PROOF_MIN = 2;
const PROOF_MAX = 3;

export function buildProjects(input: ProjectInput): Project[] {
  const { ordering, contents, facts } = input;
  const problems: string[] = [];

  const featuredCount = ordering.featured.length;
  if (featuredCount < FEATURED_MIN || featuredCount > FEATURED_MAX) {
    problems.push(
      `the featured list must hold ${FEATURED_MIN} to ${FEATURED_MAX} projects, it holds ${featuredCount}`,
    );
  }
  for (const name of ordering.featured) {
    if (ordering.archive.includes(name)) {
      problems.push(`${name} is in both the featured list and the archive`);
    }
  }

  const projects: Project[] = [];
  const entries = [
    ...ordering.featured.map((name, i) => ({
      name,
      featured: true,
      position: i + 1,
    })),
    ...ordering.archive.map((name, i) => ({
      name,
      featured: false,
      position: i + 1,
    })),
  ];
  for (const { name, featured, position } of entries) {
    const content = contents.get(name);
    if (!content) {
      problems.push(`${name} has no content file`);
    } else if (!content.pitch.trim()) {
      problems.push(`${name} has no pitch`);
    } else if (featured) {
      const count = content.proof?.length ?? 0;
      if (count < PROOF_MIN || count > PROOF_MAX) {
        problems.push(
          `${name} is featured and needs ${PROOF_MIN} to ${PROOF_MAX} proof lines, it has ${count}`,
        );
      }
    }

    const repo = facts.get(name);
    if (!repo) {
      problems.push(
        `${name}: the repository is missing or private to the build's token`,
      );
    } else if (repo.isPrivate) {
      problems.push(`${name}: the repository is private`);
    } else if (repo.name !== name) {
      problems.push(
        `${name}: GitHub returned the repository as ${repo.name}; fix the name in projects.yaml`,
      );
    }

    if (content && repo && problems.length === 0) {
      projects.push({
        repository: name,
        featured,
        position,
        name: content.name?.trim() || name,
        pitch: content.pitch.trim(),
        proof: featured ? (content.proof ?? []) : [],
        body: content.body?.trim() ?? "",
        live: content.live ?? null,
        repositoryUrl: repo.url,
        language: content.language?.trim() || repo.language,
        version: content.hideVersion
          ? null
          : pickVersion(repo.url, repo.releases, repo.tags),
      });
    }
  }

  if (problems.length > 0) throw new ProjectsError(problems);
  return projects;
}
