import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import type { GraphQLResponse } from "../src/lib/github";
import { buildQuery, fetchFacts, parseResponse } from "../src/lib/github";
import {
  buildProjects,
  type ContentFile,
  type Ordering,
} from "../src/lib/projects-core";
import { contentSchema, orderingSchema } from "../src/lib/schemas";
import recorded from "./fixtures/github-projects.json";

const root = new URL("../src/content/", import.meta.url).pathname;
const response = recorded as unknown as GraphQLResponse;

/** What Astro's `file()` and `glob()` loaders hand to the schemas. */
function readContent() {
  const lists = (
    Bun.YAML.parse(readFileSync(`${root}projects.yaml`, "utf8")) as unknown[]
  ).map((item) => orderingSchema.parse(item));
  const listed = (id: string) => lists.find((l) => l.id === id)?.projects ?? [];
  const ordering: Ordering = {
    featured: listed("featured"),
    archive: listed("archive"),
  };
  const contents = new Map<string, ContentFile>();
  for (const folder of readdirSync(`${root}projects`)) {
    const text = readFileSync(`${root}projects/${folder}/index.md`, "utf8");
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    const data = contentSchema.parse(Bun.YAML.parse(match?.[1] ?? ""));
    contents.set(folder, { ...data, body: match?.[2] ?? "" });
  }
  return { ordering, contents };
}

function real() {
  const { ordering, contents } = readContent();
  const names = [...ordering.featured, ...ordering.archive];
  const facts = parseResponse([...names, "deleted-example"], response);
  return { ordering, contents, facts };
}

describe("the real content with the recorded GitHub response", () => {
  test("seven projects in the decided order", () => {
    const projects = buildProjects(real());
    expect(projects.map((p) => [p.repository, p.featured])).toEqual([
      ["issho", true],
      ["rapid-radiology", true],
      ["orca-flow", true],
      ["unmacos", true],
      ["claude-orchestrate", false],
      ["TrueCrypt-Steganography", false],
      ["aidan-landing-page", false],
    ]);
  });

  test("versions match what was decided", () => {
    const versions = buildProjects(real()).map((p) => [
      p.repository,
      p.version?.label ?? null,
      p.version?.source ?? null,
    ]);
    expect(versions).toEqual([
      ["issho", "v1.0.0", "release"],
      ["rapid-radiology", null, null],
      ["orca-flow", "v0.9.1", "tag"],
      ["unmacos", "v1.5.0", "release"],
      ["claude-orchestrate", "v0.8.0", "release"],
      ["TrueCrypt-Steganography", null, null],
      ["aidan-landing-page", null, null],
    ]);
  });

  test("rapid-radiology links its live site; every project has a pitch", () => {
    const projects = buildProjects(real());
    const rr = projects.find((p) => p.repository === "rapid-radiology");
    expect(rr?.live).toBe("https://shrujancheruku.github.io/rapid-radiology/");
    expect(projects.every((p) => p.pitch.length > 0)).toBe(true);
    expect(projects.find((p) => p.repository === "issho")?.live).toBe(
      "https://joinissho.com",
    );
  });

  test("a project missing from the response fails by name", () => {
    const input = real();
    input.ordering.archive.push("deleted-example");
    input.contents.set("deleted-example", { pitch: "x" });
    expect(() => buildProjects(input)).toThrow(
      /deleted-example.*missing or private/,
    );
  });
});

describe("schemas", () => {
  test("the version cannot be set from a content file", () => {
    expect(
      contentSchema.safeParse({ pitch: "x", version: "v9.9.9" }).success,
    ).toBe(false);
  });

  test("a pitch is required and may not be blank", () => {
    expect(contentSchema.safeParse({}).success).toBe(false);
    expect(contentSchema.safeParse({ pitch: "  " }).success).toBe(false);
  });

  test("overrides and the version switch are read", () => {
    expect(
      contentSchema.parse({
        pitch: "x",
        name: "P",
        language: "Rust",
        hideVersion: true,
      }),
    ).toEqual({ pitch: "x", name: "P", language: "Rust", hideVersion: true });
  });

  test("a live link must be an address", () => {
    expect(contentSchema.safeParse({ pitch: "x", live: "soon" }).success).toBe(
      false,
    );
  });

  test("a list is featured or archive, and holds names", () => {
    expect(
      orderingSchema.safeParse({ id: "featured", projects: ["a"] }).success,
    ).toBe(true);
    expect(
      orderingSchema.safeParse({ id: "spare", projects: ["a"] }).success,
    ).toBe(false);
    expect(
      orderingSchema.safeParse({ id: "archive", projects: [1] }).success,
    ).toBe(false);
  });
});

describe("the GitHub request", () => {
  test("is one query for every project, by alias", () => {
    const query = buildQuery("o", ["a", "b"]);
    expect(query).toContain('r0: repository(owner: "o", name: "a")');
    expect(query).toContain('r1: repository(owner: "o", name: "b")');
  });

  test("asks for the newest tags first, so a repository with over 100 keeps its latest", () => {
    // GitHub lists refs alphabetically by default and the page holds 100
    expect(buildQuery("o", ["a"])).toContain(
      'refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC })',
    );
  });

  test("sends one POST with the token and parses the recorded answer", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get("Authorization") });
      return new Response(JSON.stringify(recorded), { status: 200 });
    }) as unknown as typeof fetch;
    const facts = await fetchFacts(
      "shrujancheruku",
      ["issho", "x", "x", "x", "x", "x", "x", "deleted-example"],
      "t0k",
      fake,
    );
    expect(calls).toEqual([
      { url: "https://api.github.com/graphql", auth: "Bearer t0k" },
    ]);
    expect(facts.get("issho")?.language).toBe("Go");
    expect(facts.get("deleted-example")).toBeNull();
  });

  test("an error other than not-found is thrown", () => {
    expect(() =>
      parseResponse(["a"], {
        errors: [{ type: "RATE_LIMITED", message: "slow down" }],
      }),
    ).toThrow(/slow down/);
  });
});
