import { describe, expect, test } from "bun:test";
import type { RepositoryFacts } from "../src/lib/github";
import {
  buildProjects,
  type ContentFile,
  type Ordering,
  ProjectsError,
} from "../src/lib/projects-core";

const facts = (
  name: string,
  over: Partial<RepositoryFacts> = {},
): RepositoryFacts => ({
  name,
  url: `https://github.com/o/${name}`,
  isPrivate: false,
  language: "Go",
  releases: [],
  tags: [],
  ...over,
});

const content = (over: Partial<ContentFile> = {}): ContentFile => ({
  pitch: "A pitch",
  proof: ["one", "two"],
  ...over,
});

const names = (...n: string[]) => n;
const ok = (...n: string[]) =>
  new Map<string, RepositoryFacts | null>(n.map((x) => [x, facts(x)]));

function setup(featured: string[], archive: string[] = ["z"]) {
  const all = [...featured, ...archive];
  return {
    ordering: { featured, archive } as Ordering,
    contents: new Map(all.map((n) => [n, content()])),
    facts: ok(...all),
  };
}

function failure(input: ReturnType<typeof setup>): string[] {
  try {
    buildProjects(input);
  } catch (e) {
    expect(e).toBeInstanceOf(ProjectsError);
    return (e as ProjectsError).problems;
  }
  throw new Error("expected the build to fail");
}

describe("projects: assembly", () => {
  test("keeps list order and marks featured projects", () => {
    const input = setup(names("c", "a", "b"), names("y", "x"));
    const projects = buildProjects(input);
    expect(projects.map((p) => [p.repository, p.featured])).toEqual([
      ["c", true],
      ["a", true],
      ["b", true],
      ["y", false],
      ["x", false],
    ]);
  });

  test("display name defaults to the repository name; content overrides it", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("a", content({ name: "Alpha" }));
    const [a, b] = buildProjects(input);
    expect([a?.name, b?.name]).toEqual(["Alpha", "b"]);
  });

  test("main language: content overrides GitHub; a missing one is null", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("a", content({ language: "Rust" }));
    input.facts.set("b", facts("b", { language: null }));
    const [a, b, c] = buildProjects(input);
    expect([a?.language, b?.language, c?.language]).toEqual([
      "Rust",
      null,
      "Go",
    ]);
  });

  test("the version comes from GitHub, and content can hide it", () => {
    const input = setup(names("a", "b", "c"));
    input.facts.set("a", facts("a", { tags: ["v1.2.0"] }));
    input.facts.set("b", facts("b", { tags: ["v1.2.0"] }));
    input.contents.set("b", content({ hideVersion: true }));
    const [a, b, c] = buildProjects(input);
    expect(a?.version?.label).toBe("v1.2.0");
    expect(b?.version).toBeNull();
    expect(c?.version).toBeNull();
  });

  test("a live link is present only when the content file gives one", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("a", content({ live: "https://example.com" }));
    const [a, b] = buildProjects(input);
    expect([a?.live, b?.live]).toEqual(["https://example.com", null]);
  });

  test("an archive project is not held to the proof-line rule", () => {
    const input = setup(names("a", "b", "c"), names("z"));
    input.contents.set("z", content({ proof: [] }));
    expect(() => buildProjects(input)).not.toThrow();
  });
});

describe("projects: build failures name the project", () => {
  test("no pitch", () => {
    const input = setup(names("a", "b", "c"), names("z"));
    input.contents.set("z", content({ pitch: "  " }));
    expect(failure(input)).toEqual([expect.stringContaining("z")]);
    expect(failure(input)[0]).toContain("pitch");
  });

  test("no content file", () => {
    const input = setup(names("a", "b", "c"), names("z"));
    input.contents.delete("z");
    expect(failure(input)[0]).toMatch(/z.*content file/);
  });

  test("a featured project with one proof line", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("b", content({ proof: ["only"] }));
    expect(failure(input)[0]).toMatch(/b.*proof lines/);
  });

  test("a featured project with four proof lines", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("c", content({ proof: ["1", "2", "3", "4"] }));
    expect(failure(input)[0]).toMatch(/c.*2 to 3 proof lines/);
  });

  test("two and three proof lines are fine", () => {
    const input = setup(names("a", "b", "c"));
    input.contents.set("a", content({ proof: ["1", "2"] }));
    input.contents.set("b", content({ proof: ["1", "2", "3"] }));
    expect(() => buildProjects(input)).not.toThrow();
  });

  test("a featured list of two or seven", () => {
    expect(failure(setup(names("a", "b")))[0]).toMatch(
      /featured list.*3 to 6.*2/,
    );
    const seven = names("a", "b", "c", "d", "e", "f", "g");
    expect(failure(setup(seven))[0]).toMatch(/featured list.*3 to 6.*7/);
  });

  test("three and six featured are fine", () => {
    expect(() => buildProjects(setup(names("a", "b", "c")))).not.toThrow();
    expect(() =>
      buildProjects(setup(names("a", "b", "c", "d", "e", "f"))),
    ).not.toThrow();
  });

  test("a project in both lists", () => {
    const input = setup(names("a", "b", "c"), names("b"));
    expect(failure(input)[0]).toMatch(/b.*both/);
  });

  test("a repository that is missing", () => {
    const input = setup(names("a", "b", "c"));
    input.facts.set("a", null);
    expect(failure(input)[0]).toMatch(/a.*missing or private/);
  });

  test("a repository that is private", () => {
    const input = setup(names("a", "b", "c"));
    input.facts.set("b", facts("b", { isPrivate: true }));
    expect(failure(input)[0]).toMatch(/b.*private/);
  });

  test("a repository returned under a different name", () => {
    const input = setup(names("a", "b", "c"));
    input.facts.set("c", facts("c-renamed"));
    expect(failure(input)[0]).toMatch(/c.*c-renamed/);
  });

  test("reports every problem at once", () => {
    const input = setup(names("a", "b"), names("z"));
    input.contents.set("z", content({ pitch: "" }));
    input.facts.set("a", null);
    expect(failure(input)).toHaveLength(3);
  });
});
