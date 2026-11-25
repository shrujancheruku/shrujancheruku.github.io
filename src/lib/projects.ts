/**
 * The projects module (#36): every selected project with its content and its
 * GitHub facts. Later tickets read projects only through `getProjects()`.
 *
 * The content comes from the `ordering` and `projects` collections
 * (`src/content.config.ts`); the rest of the rules live in `projects-core.ts`.
 * Fails the build, with a message naming the project, when the content or
 * GitHub disagree with the spec.
 */

import { getCollection } from "astro:content";
import { execFileSync } from "node:child_process";
import { fetchFacts } from "./github";
import {
  buildProjects,
  type ContentFile,
  type Ordering,
  type Project,
} from "./projects-core";

export type { Project } from "./projects-core";
export type { Version } from "./releases";

const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "shrujancheruku";

function token(): string {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  // Locally, borrow the `gh` login; the workflow passes its own token.
  try {
    const out = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // fall through to the message below
  }
  throw new Error(
    "No GitHub token: set GITHUB_TOKEN or sign in with `gh auth login`",
  );
}

let cached: Promise<Project[]> | undefined;

async function load(): Promise<Project[]> {
  const lists = await getCollection("ordering");
  const listed = (id: string) =>
    lists.find((entry) => entry.id === id)?.data.projects ?? [];
  const ordering: Ordering = {
    featured: listed("featured"),
    archive: listed("archive"),
  };

  const contents = new Map<string, ContentFile>();
  for (const entry of await getCollection("projects")) {
    contents.set(entry.id, { ...entry.data, body: entry.body ?? "" });
  }

  const names = [...ordering.featured, ...ordering.archive];
  const facts = await fetchFacts(owner, names, token());
  return buildProjects({ ordering, contents, facts });
}

/** Every selected project: the featured ones in order, then the archive. */
export function getProjects(): Promise<Project[]> {
  cached ??= load();
  return cached;
}

export async function getFeatured(): Promise<Project[]> {
  return (await getProjects()).filter((p) => p.featured);
}

export async function getArchive(): Promise<Project[]> {
  return (await getProjects()).filter((p) => !p.featured);
}
