import { describe, expect, test } from "bun:test";
import {
  assertOnePage,
  buildResume,
  descriptionFor,
  driftIn,
  fingerprint,
} from "../src/lib/resume";
import { type Entry, timeline } from "../src/lib/timeline";

const entry = (over: Partial<Entry> = {}): Entry => ({
  roles: [{ dates: "Jan 2020 – Dec 2020", title: "Engineer" }],
  organisation: "Acme",
  description: "Built things.",
  technologies: [],
  ...over,
});

describe("the site-wording fingerprint", () => {
  test("is the first 12 hex digits of the SHA-256 of the wording", () => {
    // literals from `printf '…' | shasum -a 256`
    expect(fingerprint("Built things.")).toBe("a564a53125b9");
    expect(fingerprint("Built things, fast.")).toBe("f07e16c26d6f");
  });

  test("ignores line breaks and runs of spaces, not words", () => {
    expect(fingerprint("  Built\n  things.  ")).toBe(
      fingerprint("Built things."),
    );
    expect(fingerprint("Built thing.")).not.toBe(fingerprint("Built things."));
  });
});

describe("resume-only descriptions", () => {
  test("an entry without its own wording uses the site's", () => {
    expect(descriptionFor(entry())).toBe("Built things.");
  });

  test("an entry with its own wording uses that on the resume", () => {
    const e = entry({
      resume: { description: "Built.", from: fingerprint("Built things.") },
    });
    expect(descriptionFor(e)).toBe("Built.");
  });

  test("no drift while the site wording is the one the resume was written from", () => {
    const e = entry({
      resume: { description: "Built.", from: "a564a53125b9" },
    });
    expect(driftIn([e, entry()])).toEqual([]);
  });

  test("drift names the entry and the fingerprint to re-confirm when the site wording changes", () => {
    const e = entry({
      description: "Built things, fast.",
      resume: { description: "Built.", from: "a564a53125b9" },
    });
    expect(driftIn([entry(), e])).toEqual([
      {
        entry: "Acme",
        recorded: "a564a53125b9",
        current: "f07e16c26d6f",
      },
    ]);
  });

  test("an entry with no organisation is named by its newest title", () => {
    const { organisation: _, ...bare } = entry({
      description: "Built things, fast.",
      resume: { description: "Built.", from: "a564a53125b9" },
    });
    expect(driftIn([bare])[0]?.entry).toBe("Engineer");
  });
});

describe("the one-page rule", () => {
  test("one page passes", () => {
    expect(() => assertOnePage(1)).not.toThrow();
  });

  test("a second page fails the build, saying how many", () => {
    expect(() => assertOnePage(2)).toThrow(/2 pages/);
  });
});

describe("the resume's content", () => {
  const r = buildResume();

  test("the header is the name, the title and four ways to reach Shrujan", () => {
    expect(r.name).toBe("Shrujan Cheruku");
    expect(r.title).toBe("Senior Product Engineer");
    expect(r.contacts.map((c) => [c.label, c.text])).toEqual([
      ["Email", "shrujancheruku@gmail.com"],
      ["LinkedIn", "linkedin.com/in/shrujancheruku"],
      ["GitHub", "github.com/shrujancheruku"],
      ["Site", "shrujancheruku.github.io"],
    ]);
  });

  test("states no phone, location, nationality or summary", () => {
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/\+?\d[\d\s().-]{8,}\d/);
    expect(text).not.toMatch(/Dallas|Remote|American|Who am I/i);
  });

  test("the five timeline entries come from the shared content, newest first", () => {
    expect(r.entries.map((e) => e.organisation ?? e.roles[0]?.title)).toEqual([
      "Sabbatical",
      "OpenBench",
      "Unsupervised",
      "Ibotta",
      "Orderly Health",
    ]);
    expect(r.entries[2]?.roles.map((x) => x.title)).toEqual([
      "Senior Software Engineer",
      "Full Stack Engineer",
    ]);
    expect(r.entries[1]?.description).toBe(timeline[1]?.description);
  });

  test("Education & Internships is fully expanded: degree, teaching post, four internships' worth of roles", () => {
    expect(r.education.degree).toBe("B.Sc Computer Science");
    expect(r.education.roles.map((e) => e.organisation)).toEqual([
      "Sandia National Laboratories",
      "University of Illinois Urbana-Champaign",
      "Indian School of Business",
      "EiQ Networks",
    ]);
  });

  test("the four real skill bars and no Comedic Talent, languages and all nine hobbies", () => {
    expect(r.bars.map((b) => b.name)).toEqual([
      "Python",
      "React + TypeScript",
      "Kubernetes + Helm",
      "Go",
    ]);
    expect(r.languages).toHaveLength(5);
    expect(r.hobbies).toHaveLength(9);
  });
});
