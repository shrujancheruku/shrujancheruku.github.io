import { describe, expect, test } from "bun:test";
import {
  createAddressBook,
  DESCRIPTION,
  notFoundTitle,
  titleForProject,
} from "../src/lib/addresses";
import { createWorkspaces, firstStepOf } from "../src/lib/workspaces";

const workspaces = createWorkspaces({ featured: 3 });
const book = createAddressBook(workspaces, [
  { repository: "issho", pitch: "Find your people." },
  { repository: "unmacos", pitch: "A Mac in a tab." },
  { repository: "TrueCrypt-Steganography", pitch: "Hide things." },
]);

describe("the address book", () => {
  test("each workspace has its path and title from the spec's table", () => {
    const at = (w: number) => book.forStep(firstStepOf(workspaces, w));
    expect([0, 2, 3, 4].map((w) => [at(w).path, at(w).title])).toEqual([
      ["/", "Shrujan Cheruku — Product Engineer"],
      ["/timeline/", "Timeline — Shrujan Cheruku"],
      ["/now/", "Sabbatical — Shrujan Cheruku"],
      ["/contact/", "Contact — Shrujan Cheruku"],
    ]);
  });

  test("the first featured project is /work/, the rest have their own slug", () => {
    expect(book.forStep(1)).toMatchObject({
      path: "/work/",
      title: "Projects — Shrujan Cheruku",
    });
    expect(book.forStep(2).path).toBe("/work/unmacos/");
    expect(book.forStep(3)).toMatchObject({
      path: "/work/truecrypt-steganography/",
      title: "TrueCrypt-Steganography — Shrujan Cheruku",
      description: "Hide things.",
    });
  });

  test("/work/issho/ opens the same step as /work/", () => {
    expect(book.stepFor("/work/issho/")).toBe(1);
    expect(book.stepFor("/work/")).toBe(1);
    expect(book.stepFor("/work/unmacos/")).toBe(2);
  });

  test("other addresses use the standing description", () => {
    expect(book.forStep(0).description).toBe(DESCRIPTION);
    expect(DESCRIPTION).toBe(
      "I design and build. Give me a problem, not a spec.",
    );
  });

  test("unknown paths have no step; a missing trailing slash is tolerated", () => {
    expect(book.stepFor("/nope/")).toBeUndefined();
    expect(book.stepFor("/timeline")).toBe(book.stepFor("/timeline/"));
  });

  test("every address is listed once for the entry pages", () => {
    const paths = book.entries.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/work/issho/");
    expect(paths.every((p) => p.endsWith("/"))).toBe(true);
  });

  test("extra addresses can be added without changing the mechanism", () => {
    const more = createAddressBook(
      workspaces,
      [],
      [
        {
          path: "/archive/",
          title: "Archive — Shrujan Cheruku",
          description: DESCRIPTION,
          step: 1,
        },
      ],
    );
    expect(more.stepFor("/archive/")).toBe(1);
    // the step's own address is still the first one
    expect(more.forStep(1).path).toBe("/work/");
  });

  test("helper titles", () => {
    expect(notFoundTitle).toBe("Not found — Shrujan Cheruku");
    expect(titleForProject("orca-flow")).toBe("orca-flow — Shrujan Cheruku");
  });
});
