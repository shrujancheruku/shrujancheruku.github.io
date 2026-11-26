// Runs after `astro build`: fails the build when a built photo is over 150 KB
// (see src/lib/budgets.ts). Photos are the raster images in dist/_astro/.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  type BuiltFile,
  overPhotoBudget,
  PHOTO_BUDGET_BYTES,
} from "../src/lib/budgets";
import { DIST } from "./serve-dist";

const dir = `${DIST}_astro/`;
const names = await readdir(dir);

const files: BuiltFile[] = [];
for (const name of names) {
  const info = await stat(join(dir, name));
  if (info.isFile()) files.push({ name: `_astro/${name}`, bytes: info.size });
}

const over = overPhotoBudget(files);
if (over.length > 0) {
  for (const { name, bytes } of over) {
    console.error(
      `✗ ${name} is ${Math.ceil(bytes / 1024)} KB; a photo must be at most ${PHOTO_BUDGET_BYTES / 1024} KB`,
    );
  }
  process.exit(1);
}
console.log(`✓ no photo over ${PHOTO_BUDGET_BYTES / 1024} KB`);
