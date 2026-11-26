import { describe, expect, test } from "bun:test";
import { findCollisions, type Repository } from "../src/lib/collisions";
import recorded from "./fixtures/repos.json";

const owner = "shrujancheruku";
const repos: Repository[] = recorded;

describe("path collision check", () => {
  test("the site's own top-level names collide with nothing", () => {
    const output = [
      "index.html",
      "_astro",
      "fonts",
      "favicon.svg",
      "work",
      "timeline",
      "now",
      "contact",
      "archive",
      "resume",
    ];
    expect(findCollisions(output, repos, owner)).toEqual([]);
  });

  test("an output name equal to a Pages-enabled repository collides", () => {
    expect(findCollisions(["work", "unmacos"], repos, owner)).toEqual([
      { output: "unmacos", repository: "unmacos" },
    ]);
  });

  test("the match ignores case in both directions", () => {
    expect(findCollisions(["portfolio", "UNMACOS"], repos, owner)).toEqual([
      { output: "portfolio", repository: "Portfolio" },
      { output: "UNMACOS", repository: "unmacos" },
    ]);
  });

  test("a repository without Pages does not collide", () => {
    const withoutPages = repos.find((r) => !r.has_pages);
    expect(withoutPages).toBeDefined();
    const name = withoutPages?.name ?? "";
    expect(findCollisions([name], repos, owner)).toEqual([]);
  });

  test("the user site's own repository is not a project site", () => {
    expect(findCollisions(["shrujancheruku.github.io"], repos, owner)).toEqual(
      [],
    );
  });
});
