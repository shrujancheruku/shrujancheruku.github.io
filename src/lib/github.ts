/**
 * The one GraphQL request of the build (#36, #15): for each selected
 * repository, its link, main language, releases and tags.
 */
import { execFileSync } from "node:child_process";
import type { Release } from "./releases";

/** Whose repositories the site lists: the workflow's owner, else the site's. */
export const owner = (): string =>
  process.env.GITHUB_REPOSITORY_OWNER ?? "shrujancheruku";

/**
 * A GitHub token from the environment, or locally the `gh` login; undefined
 * when there is neither. The workflow passes its own token.
 */
export function githubToken(): string | undefined {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const out = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export interface RepositoryFacts {
  /** The name GitHub returned, which must equal the one requested. */
  name: string;
  url: string;
  isPrivate: boolean;
  language: string | null;
  releases: Release[];
  tags: string[];
}

/** A repository the request could not return, keyed by requested name. */
export type FactsByName = Map<string, RepositoryFacts | null>;

const fields = `
  name url isPrivate
  primaryLanguage { name }
  releases(first: 30, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes { tagName url isPrerelease isDraft }
  }
  refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) { nodes { name } }`;

export function buildQuery(owner: string, names: readonly string[]): string {
  const aliases = names.map(
    (name, i) =>
      `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {${fields}}`,
  );
  return `query {\n${aliases.join("\n")}\n}`;
}

interface RawRepository {
  name: string;
  url: string;
  isPrivate: boolean;
  primaryLanguage: { name: string } | null;
  releases: {
    nodes: (Release & { isDraft: boolean })[];
  };
  refs: { nodes: { name: string }[] };
}

export interface GraphQLResponse {
  data?: Record<string, RawRepository | null> | null;
  errors?: { type?: string; message: string; path?: (string | number)[] }[];
}

/**
 * Turns a response to `buildQuery(owner, names)` into facts. A NOT_FOUND error
 * (deleted, or private to this token) gives `null` for that name; any other
 * error is thrown, since the build cannot trust the rest.
 */
export function parseResponse(
  names: readonly string[],
  response: GraphQLResponse,
): FactsByName {
  const unexpected = (response.errors ?? []).filter(
    (error) => error.type !== "NOT_FOUND",
  );
  if (unexpected.length > 0) {
    throw new Error(
      `GitHub GraphQL error: ${unexpected.map((e) => e.message).join("; ")}`,
    );
  }
  const data = response.data ?? {};
  const facts: FactsByName = new Map();
  names.forEach((name, i) => {
    const raw = data[`r${i}`];
    if (!raw) {
      facts.set(name, null);
      return;
    }
    facts.set(name, {
      name: raw.name,
      url: raw.url,
      isPrivate: raw.isPrivate,
      language: raw.primaryLanguage?.name ?? null,
      releases: raw.releases.nodes
        .filter((release) => !release.isDraft)
        .map(({ tagName, url, isPrerelease }) => ({
          tagName,
          url,
          isPrerelease,
        })),
      tags: raw.refs.nodes.map((ref) => ref.name),
    });
  });
  return facts;
}

export async function fetchFacts(
  owner: string,
  names: readonly string[],
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FactsByName> {
  const res = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: buildQuery(owner, names) }),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for GraphQL`);
  return parseResponse(names, (await res.json()) as GraphQLResponse);
}
