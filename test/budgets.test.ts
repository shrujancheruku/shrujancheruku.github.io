import { describe, expect, test } from "bun:test";
import { overPhotoBudget, PHOTO_BUDGET_BYTES } from "../src/lib/budgets";

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
