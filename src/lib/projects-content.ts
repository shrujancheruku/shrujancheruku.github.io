/** Reads `projects.yaml` and the per-project `index.md` files from disk. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import {
  type ContentFile,
  type Ordering,
  ProjectsError,
} from "./projects-core";

export interface Content {
  ordering: Ordering;
  contents: Map<string, ContentFile>;
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

export function parseOrdering(text: string): Ordering {
  const raw = parse(text) as Record<string, unknown> | null;
  const featured = raw?.featured;
  const archive = raw?.archive ?? [];
  if (!strings(featured) || !strings(archive)) {
    throw new ProjectsError([
      "projects.yaml needs `featured` and `archive` as lists of repository names",
    ]);
  }
  return { featured, archive };
}

export function parseContentFile(name: string, text: string): ContentFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new ProjectsError([`${name}/index.md has no frontmatter`]);
  const data = (parse(match[1] ?? "") ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const optionalString = (key: string) => {
    const value = data[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string")
      problems.push(`${name}: \`${key}\` must be text`);
    return typeof value === "string" ? value : undefined;
  };
  const pitch = optionalString("pitch") ?? "";
  const live = optionalString("live");
  const displayName = optionalString("name");
  const language = optionalString("language");
  const proof = data.proof;
  if (proof !== undefined && !strings(proof)) {
    problems.push(`${name}: \`proof\` must be a list of text`);
  }
  const hideVersion = data.hideVersion;
  if (hideVersion !== undefined && typeof hideVersion !== "boolean") {
    problems.push(`${name}: \`hideVersion\` must be true or false`);
  }
  if ("version" in data) {
    problems.push(
      `${name}: the version comes from GitHub and cannot be set here`,
    );
  }
  if (problems.length > 0) throw new ProjectsError(problems);
  return {
    pitch,
    ...(strings(proof) && { proof }),
    ...(live !== undefined && { live }),
    ...(displayName !== undefined && { name: displayName }),
    ...(language !== undefined && { language }),
    ...(typeof hideVersion === "boolean" && { hideVersion }),
    body: match[2] ?? "",
  };
}

export async function readContent(root: string): Promise<Content> {
  const ordering = parseOrdering(
    await readFile(join(root, "projects.yaml"), "utf8"),
  );
  const contents = new Map<string, ContentFile>();
  for (const name of [...ordering.featured, ...ordering.archive]) {
    let text: string;
    try {
      text = await readFile(join(root, "projects", name, "index.md"), "utf8");
    } catch {
      continue; // buildProjects reports the missing content file by name
    }
    contents.set(name, parseContentFile(name, text));
  }
  return { ordering, contents };
}
