import { describe, expect, test } from "bun:test";
import {
  assertOnePage,
  descriptionFor,
  driftIn,
  fingerprint,
} from "../src/lib/resume";
import type { Entry } from "../src/lib/timeline";

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
    expect(fingerprint("  Built\n  things.  ")).toBe(fingerprint("Built things."));
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
    const e = entry({
      organisation: undefined,
      description: "Built things, fast.",
      resume: { description: "Built.", from: "a564a53125b9" },
    });
    expect(driftIn([e])[0]?.entry).toBe("Engineer");
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
