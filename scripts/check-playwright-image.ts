// Every Playwright container image in the Pages workflow must match the
// @playwright/test version in package.json, so the build and every e2e shard
// run the browser the test runner expects.
import { readFileSync } from "node:fs";
import { expectedImage, mismatchedImages } from "../src/lib/playwright-image";

const workflow = ".github/workflows/pages.yml";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version: string = pkg.devDependencies["@playwright/test"];
const bad = mismatchedImages(readFileSync(workflow, "utf8"), version);

if (bad.length > 0) {
  console.error(`✗ ${workflow} wants ${expectedImage(version)}, found:`);
  for (const image of bad) console.error(`  ${image}`);
  process.exit(1);
}
console.log(`✓ every Playwright image is ${expectedImage(version)}`);
