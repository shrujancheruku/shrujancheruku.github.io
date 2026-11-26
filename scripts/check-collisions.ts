// Runs after `astro build`: fails the build when a top-level output name
// matches a Pages-enabled repository of the owner (see src/lib/collisions.ts).
import { readdir } from "node:fs/promises";
import { findCollisions, type Repository } from "../src/lib/collisions";
import { githubToken, owner } from "../src/lib/github";
import { DIST } from "./serve-dist";

async function ownerRepositories(): Promise<Repository[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const repos: Repository[] = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/users/${owner()}/repos?type=owner&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub answered ${res.status} for ${url}`);
    }
    const batch = (await res.json()) as Repository[];
    repos.push(...batch.map(({ name, has_pages }) => ({ name, has_pages })));
    if (batch.length < 100) return repos;
  }
}

const outputNames = await readdir(DIST);

if (outputNames.some((name) => name.toLowerCase() === "legacy")) {
  console.error("✗ legacy/ is in the build output; it must not be published");
  process.exit(1);
}

const collisions = findCollisions(
  outputNames,
  await ownerRepositories(),
  owner(),
);
if (collisions.length > 0) {
  for (const { output, repository } of collisions) {
    console.error(
      `✗ /${output} collides with the Pages site of ${owner}/${repository}`,
    );
  }
  process.exit(1);
}
console.log(`✓ no collisions among ${outputNames.length} top-level names`);
