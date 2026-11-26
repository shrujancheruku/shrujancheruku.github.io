import { describe, expect, test } from "bun:test";
import { mismatchedImages } from "../src/lib/playwright-image";

const image = (v: string) =>
  `    image: mcr.microsoft.com/playwright:v${v}-noble`;

describe("mismatchedImages", () => {
  test("passes when every image matches", () => {
    const yml = [image("1.65.1"), "steps:", image("1.65.1")].join("\n");
    expect(mismatchedImages(yml, "1.65.1")).toEqual([]);
  });

  test("a single mismatched line fails, even when another matches", () => {
    const yml = [image("1.65.1"), "steps:", image("1.64.0")].join("\n");
    expect(mismatchedImages(yml, "1.65.1")).toEqual([
      "mcr.microsoft.com/playwright:v1.64.0-noble",
    ]);
  });

  test("a workflow with no Playwright image fails", () => {
    expect(mismatchedImages("jobs: {}", "1.65.1")).toHaveLength(1);
  });

  test("the real workflow matches package.json", async () => {
    const yml = await Bun.file(".github/workflows/pages.yml").text();
    const pkg = await Bun.file("package.json").json();
    expect(
      mismatchedImages(yml, pkg.devDependencies["@playwright/test"]),
    ).toEqual([]);
  });
});
