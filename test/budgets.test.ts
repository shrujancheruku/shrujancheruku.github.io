import { describe, expect, test } from "bun:test";
import {
  FIRST_LOAD_BUDGET_BYTES,
  FONT_BUDGET_BYTES,
  lazyInFirstLoad,
  loadBudgetReport,
  overPhotoBudget,
  PHOTO_BUDGET_BYTES,
} from "../src/lib/budgets";

const KB = 1024;

describe("photo budget", () => {
  test("a photo of exactly 150 KB is within budget", () => {
    expect(
      overPhotoBudget([{ name: "_astro/lisbon.Ab12.webp", bytes: 150 * KB }]),
    ).toEqual([]);
  });

  test("a photo one byte over 150 KB is reported", () => {
    const big = { name: "_astro/lisbon.Ab12.webp", bytes: 150 * KB + 1 };
    expect(overPhotoBudget([big])).toEqual([big]);
  });

  test("the limit is 150 KB", () => {
    expect(PHOTO_BUDGET_BYTES).toBe(150 * KB);
  });

  test("only image files are judged; a large script is not a photo", () => {
    const script = { name: "_astro/bundle.Ff34.js", bytes: 900 * KB };
    const jpg = { name: "_astro/hk.Cc56.jpg", bytes: 200 * KB };
    const png = { name: "_astro/hk.Dd78.png", bytes: 10 * KB };
    expect(overPhotoBudget([script, jpg, png])).toEqual([jpg]);
  });

  test("reports every oversized photo, in the order given", () => {
    const a = { name: "_astro/a.webp", bytes: 151 * KB };
    const ok = { name: "_astro/b.avif", bytes: 40 * KB };
    const c = { name: "_astro/c.jpeg", bytes: 400 * KB };
    expect(overPhotoBudget([a, ok, c])).toEqual([a, c]);
  });
});

describe("first-load and font budgets", () => {
  test("the limits are 250 KB and 100 KB", () => {
    expect(FIRST_LOAD_BUDGET_BYTES).toBe(250 * KB);
    expect(FONT_BUDGET_BYTES).toBe(100 * KB);
  });

  test("exactly at the limits passes", () => {
    const r = loadBudgetReport({ firstLoad: 250 * KB, fonts: 100 * KB });
    expect(r.failures).toEqual([]);
  });

  test("a byte over the first-load budget fails and names the measured size", () => {
    const r = loadBudgetReport({ firstLoad: 250 * KB + 1, fonts: 62 * KB });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("first load");
    expect(r.failures[0]).toContain("250.0 KB");
    expect(r.failures[0]).toContain("250 KB");
  });

  test("a byte over the font budget fails", () => {
    const r = loadBudgetReport({ firstLoad: 57 * KB, fonts: 100 * KB + 1 });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("fonts");
  });

  test("the report always gives both measured sizes, passing or not", () => {
    const r = loadBudgetReport({ firstLoad: 57.3 * KB, fonts: 62.1 * KB });
    expect(r.lines.join("\n")).toContain("57.3 KB");
    expect(r.lines.join("\n")).toContain("62.1 KB");
  });
});

describe("what must stay out of the first load", () => {
  const names = ["issho", "orca-flow"];

  test("a composition chunk or a built photo is reported", () => {
    const requests = [
      "/_astro/desktop.Ab12.js",
      "/_astro/orca-flow.Cd34.js",
      "/_astro/lisbon.Ef56.webp",
    ];
    expect(lazyInFirstLoad(requests, names)).toEqual([
      "/_astro/orca-flow.Cd34.js",
      "/_astro/lisbon.Ef56.webp",
    ]);
  });

  test("the favicon and the page's own scripts are fine", () => {
    expect(
      lazyInFirstLoad(
        [
          "/",
          "/favicon.png",
          "/_astro/compositions.Aa11.js",
          "/_astro/crt.Bb22.js",
        ],
        names,
      ),
    ).toEqual([]);
  });
});
