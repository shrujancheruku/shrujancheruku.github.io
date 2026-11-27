import { describe, expect, test } from "bun:test";
import { archiveOf, copyOf, stackOf } from "../src/lib/project-copy";
import type { Project } from "../src/lib/projects-core";

const project = (over: Partial<Project> = {}): Project => ({
  repository: "unmacos",
  featured: true,
  position: 2,
  name: "unmacos",
  pitch: "A keyboard-first desktop for macOS.",
  proof: ["tiling windows, fuzzy menus", "23 themes."],
  body: "",
  live: "https://example.com/unmacos/",
  repositoryUrl: "https://github.com/shrujancheruku/unmacos",
  language: "Shell",
  version: {
    label: "v1.5.0",
    url: "https://github.com/shrujancheruku/unmacos/releases/tag/v1.5.0",
    source: "release",
  },
  ...over,
});

describe("the copy window", () => {
  test("counts the project among the featured", () => {
    expect(copyOf(project(), 2, 4, 3).counter).toBe("featured 2 / 4");
  });

  test("shows the name and the pitch as written", () => {
    const c = copyOf(project({ name: "TrueCrypt-Steganography" }), 1, 3, 0);
    expect(c.name).toBe("TrueCrypt-Steganography");
    expect(c.pitch).toBe("A keyboard-first desktop for macOS.");
  });

  test("proof lines keep their full stops", () => {
    expect(copyOf(project(), 1, 4, 0).proof).toEqual([
      "tiling windows, fuzzy menus",
      "23 themes.",
    ]);
  });

  test("links the repository, and the live site only when given", () => {
    expect(copyOf(project(), 1, 4, 0).links).toEqual([
      {
        label: "repository",
        href: "https://github.com/shrujancheruku/unmacos",
      },
      { label: "live site", href: "https://example.com/unmacos/" },
    ]);
    expect(
      copyOf(project({ live: null }), 1, 4, 0).links.map((l) => l.label),
    ).toEqual(["repository"]);
  });

  test("the facts line is the language, then the linked version", () => {
    expect(copyOf(project(), 1, 4, 0).facts).toEqual({
      language: "Shell",
      version: {
        label: "v1.5.0",
        href: "https://github.com/shrujancheruku/unmacos/releases/tag/v1.5.0",
      },
    });
  });

  test("a project with no language or version has neither", () => {
    expect(
      copyOf(project({ language: null, version: null }), 1, 4, 0).facts,
    ).toEqual({ language: null, version: null });
  });

  test("only the last featured project offers the archive", () => {
    expect(copyOf(project(), 3, 4, 3).archiveMore).toBeNull();
    expect(copyOf(project(), 4, 4, 3).archiveMore).toBe(
      "+3 more in the archive →",
    );
  });

  test("an empty archive offers nothing", () => {
    expect(copyOf(project(), 4, 4, 0).archiveMore).toBeNull();
  });
});

describe("the stack", () => {
  const featured = ["issho", "unmacos", "orca-flow"].map((repository, i) =>
    project({ repository, name: repository, position: i + 1 }),
  );

  test("lists every featured project with its address, in order", () => {
    expect(stackOf(featured, 3).items).toEqual([
      { name: "issho", href: "/work/issho/", position: 1 },
      { name: "unmacos", href: "/work/unmacos/", position: 2 },
      { name: "orca-flow", href: "/work/orca-flow/", position: 3 },
    ]);
  });

  test("ends with the archive count", () => {
    expect(stackOf(featured, 3).archive).toBe("+3 archive");
  });

  test("has no archive line when the archive is empty", () => {
    expect(stackOf(featured, 0).archive).toBeNull();
  });
});

describe("the archive window", () => {
  const entry = (over: Partial<Project> = {}) =>
    project({
      featured: false,
      repository: "claude-orchestrate",
      name: "claude-orchestrate",
      ...over,
    });

  test("the heading counts the entries", () => {
    expect(archiveOf([entry(), entry()]).heading).toBe("~/archive · 2");
  });

  test("an entry has the name linked to the repository, the version chip and the pitch", () => {
    const [e] = archiveOf([entry()]).entries;
    expect(e).toMatchObject({
      name: "claude-orchestrate",
      href: "https://github.com/shrujancheruku/unmacos",
      version: "v1.5.0",
      pitch: "A keyboard-first desktop for macOS.",
      slug: "claude-orchestrate",
    });
  });

  test("the facts are language, repository, live; missing parts are left out", () => {
    const all = archiveOf([entry()]).entries[0]?.facts;
    expect(all).toEqual([
      { kind: "text", label: "Shell" },
      {
        kind: "link",
        label: "repository ↗",
        href: "https://github.com/shrujancheruku/unmacos",
      },
      { kind: "link", label: "live ↗", href: "https://example.com/unmacos/" },
    ]);
    const bare = archiveOf([
      entry({ language: null, live: null, version: null }),
    ]).entries[0];
    expect(bare?.facts.map((f) => f.label)).toEqual(["repository ↗"]);
    expect(bare?.version).toBeNull();
  });
});
