import { describe, expect, test } from "bun:test";
import type { GraphQLResponse } from "../src/lib/github";
import { buildQuery, fetchFacts, parseResponse } from "../src/lib/github";
import { parseContentFile, readContent } from "../src/lib/projects-content";
import { buildProjects, ProjectsError } from "../src/lib/projects-core";
import recorded from "./fixtures/github-projects.json";

const root = new URL("../src/content/", import.meta.url).pathname;
const response = recorded as unknown as GraphQLResponse;

async function real() {
  const { ordering, contents } = await readContent(root);
  const names = [...ordering.featured, ...ordering.archive];
  const facts = parseResponse([...names, "deleted-example"], response);
  return { ordering, contents, facts, names };
}

describe("the real content with the recorded GitHub response", () => {
  test("seven projects in the decided order", async () => {
    const projects = buildProjects(await real());
    expect(projects.map((p) => [p.repository, p.featured])).toEqual([
      ["issho", true],
      ["unmacos", true],
      ["orca-flow", true],
      ["rapid-radiology", true],
      ["claude-orchestrate", false],
      ["TrueCrypt-Steganography", false],
      ["aidan-landing-page", false],
    ]);
  });

  test("versions match what was decided", async () => {
    const versions = buildProjects(await real()).map((p) => [
      p.repository,
      p.version?.label ?? null,
      p.version?.source ?? null,
    ]);
    expect(versions).toEqual([
      ["issho", "v1.0.0", "release"],
      ["unmacos", "v1.5.0", "release"],
      ["orca-flow", "v0.9.1", "tag"],
      ["rapid-radiology", null, null],
      ["claude-orchestrate", "v0.8.0", "release"],
      ["TrueCrypt-Steganography", null, null],
      ["aidan-landing-page", null, null],
    ]);
  });

  test("rapid-radiology gives no live link; every project has a pitch", async () => {
    const projects = buildProjects(await real());
    const rr = projects.find((p) => p.repository === "rapid-radiology");
    expect(rr?.live).toBeNull();
    expect(projects.every((p) => p.pitch.length > 0)).toBe(true);
    expect(projects.find((p) => p.repository === "issho")?.live).toBe(
      "https://joinissho.com",
    );
  });

  test("a project missing from the response fails by name", async () => {
    const input = await real();
    input.ordering.archive.push("deleted-example");
    input.contents.set("deleted-example", { pitch: "x" });
    expect(() => buildProjects(input)).toThrow(
      /deleted-example.*missing or private/,
    );
  });
});

describe("content files", () => {
  test("the version cannot be set from a content file", () => {
    expect(() =>
      parseContentFile("p", "---\npitch: x\nversion: v9.9.9\n---\n"),
    ).toThrow(ProjectsError);
  });

  test("frontmatter is required", () => {
    expect(() => parseContentFile("p", "just text")).toThrow(/no frontmatter/);
  });

  test("overrides and body are read", () => {
    expect(
      parseContentFile(
        "p",
        "---\npitch: x\nname: P\nlanguage: Rust\nhideVersion: true\n---\nbody\n",
      ),
    ).toEqual({
      pitch: "x",
      name: "P",
      language: "Rust",
      hideVersion: true,
      body: "body\n",
    });
  });
});

describe("the GitHub request", () => {
  test("is one query for every project, by alias", () => {
    const query = buildQuery("o", ["a", "b"]);
    expect(query).toContain('r0: repository(owner: "o", name: "a")');
    expect(query).toContain('r1: repository(owner: "o", name: "b")');
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
