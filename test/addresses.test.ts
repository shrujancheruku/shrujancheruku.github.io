import { describe, expect, test } from "bun:test";
import {
  archiveAddresses,
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
    expect([0, 1, 3, 4, 5].map((w) => [at(w).path, at(w).title])).toEqual([
      ["/", "Shrujan Cheruku — Product Engineer"],
      ["/about/", "About — Shrujan Cheruku"],
      ["/timeline/", "Timeline — Shrujan Cheruku"],
      ["/now/", "Sabbatical — Shrujan Cheruku"],
      ["/contact/", "Contact — Shrujan Cheruku"],
    ]);
  });

  test("the first featured project is /work/, the rest have their own slug", () => {
    expect(book.forStep(2)).toMatchObject({
      path: "/work/",
      title: "Projects — Shrujan Cheruku",
    });
    expect(book.forStep(3).path).toBe("/work/unmacos/");
    expect(book.forStep(4)).toMatchObject({
      path: "/work/truecrypt-steganography/",
      title: "TrueCrypt-Steganography — Shrujan Cheruku",
      description: "Hide things.",
    });
  });

  test("/work/issho/ opens the same step as /work/", () => {
    expect(book.stepFor("/work/issho/")).toBe(2);
    expect(book.stepFor("/work/")).toBe(2);
    expect(book.stepFor("/work/unmacos/")).toBe(3);
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
          step: 2,
        },
      ],
    );
    expect(more.stepFor("/archive/")).toBe(2);
    // the step's own address is still the first one
    expect(more.forStep(2).path).toBe("/work/");
  });

  test("helper titles", () => {
    expect(notFoundTitle).toBe("Not found — Shrujan Cheruku");
    expect(titleForProject("orca-flow")).toBe("orca-flow — Shrujan Cheruku");
  });
});

describe("the archive's addresses", () => {
  const withArchive = createAddressBook(
    workspaces,
    [
      { repository: "issho", pitch: "Find your people." },
      { repository: "unmacos", pitch: "A Mac in a tab." },
      { repository: "TrueCrypt-Steganography", pitch: "Hide things." },
    ],
    archiveAddresses(workspaces, [
      { repository: "claude-orchestrate", pitch: "Run many." },
      { repository: "aidan-landing-page", pitch: "A page." },
    ]),
  );

  test("/archive/ opens the last featured project's step with the archive on", () => {
    expect(withArchive.forPath("/archive/")).toMatchObject({
      path: "/archive/",
      title: "Archive — Shrujan Cheruku",
      step: 4,
      archive: "",
    });
  });

  test("an archive project opens the archive on its entry, titled and described by it", () => {
    expect(withArchive.forPath("/work/claude-orchestrate/")).toMatchObject({
      title: "claude-orchestrate — Shrujan Cheruku",
      description: "Run many.",
      step: 4,
      archive: "claude-orchestrate",
    });
  });

  test("the step keeps its own address", () => {
    expect(withArchive.forStep(4).path).toBe("/work/truecrypt-steganography/");
  });

  test("an empty archive adds nothing", () => {
    expect(archiveAddresses(workspaces, [])).toEqual([]);
  });
});
