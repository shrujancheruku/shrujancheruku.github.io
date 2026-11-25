/**
 * The projects module (#36): every selected project with its content and its
 * GitHub facts. Later tickets read projects only through `getProjects()`.
 *
 * Fails the build, with a message naming the project, when the content or
 * GitHub disagree with the spec (see `projects-core.ts`).
 */
import { fetchFacts } from "./github";
import { readContent } from "./projects-content";
import { buildProjects, type Project } from "./projects-core";

export type { Project } from "./projects-core";
export type { Version } from "./releases";

const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "shrujancheruku";
const contentRoot = new URL("../content/", import.meta.url).pathname;

async function token(): Promise<string> {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  // Locally, borrow the `gh` login; the workflow passes its own token.
  const proc = Bun.spawn(["gh", "auth", "token"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = (await new Response(proc.stdout).text()).trim();
  if ((await proc.exited) === 0 && out) return out;
  throw new Error(
    "No GitHub token: set GITHUB_TOKEN or sign in with `gh auth login`",
  );
}

let cached: Promise<Project[]> | undefined;

async function load(): Promise<Project[]> {
  const { ordering, contents } = await readContent(contentRoot);
  const names = [...ordering.featured, ...ordering.archive];
  const facts = await fetchFacts(owner, names, await token());
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
