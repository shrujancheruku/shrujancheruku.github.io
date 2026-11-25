// Runs after `astro build`: fails the build when a composition's JS plus assets
// (its chunk and the chunks it needs) is over 60 KB (src/lib/composition-rules.ts).
import { readdir, readFile, stat } from "node:fs/promises";
import { compositions } from "../src/compositions/registry";
import {
  type Chunk,
  COMPOSITION_BUDGET_BYTES,
  chunkOf,
  closureBytes,
  overCompositionBudget,
  staticImports,
} from "../src/lib/composition-rules";

const dir = new URL("../dist/_astro/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".js"));

const chunks: Record<string, Chunk> = {};
for (const name of files) {
  const url = new URL(name, dir);
  chunks[name] = {
    bytes: (await stat(url)).size,
    imports: staticImports(await readFile(url, "utf8")),
  };
}

// what the first load already has: the scripts of the opening page and what they import
const page = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const firstLoad = new Set<string>();
const loadFrom = (name: string): void => {
  if (firstLoad.has(name) || !chunks[name]) return;
  firstLoad.add(name);
  for (const i of chunks[name].imports) loadFrom(i);
};
for (const m of page.matchAll(/\/_astro\/([^"']+\.js)/g))
  if (m[1]) loadFrom(m[1]);

// the kit is loaded with every composition, so it counts against each
const kit = chunkOf("kit", files);
if (!kit) {
  console.error("✗ no built chunk for the composition kit in dist/_astro");
  process.exit(1);
}

const built = [];
for (const name of Object.keys(compositions)) {
  const chunk = chunkOf(name, files);
  if (!chunk) {
    console.error(
      `✗ no built chunk for the ${name} composition in dist/_astro`,
    );
    process.exit(1);
  }
  chunks[`${name}+kit`] = { bytes: 0, imports: [chunk, kit] };
  built.push({ name, bytes: closureBytes(`${name}+kit`, chunks, firstLoad) });
}

const over = overCompositionBudget(built);
for (const { name, bytes } of built)
  console.log(`  ${name}: ${(bytes / 1024).toFixed(1)} KB`);
if (over.length > 0) {
  for (const { name, bytes } of over)
    console.error(
      `✗ the ${name} composition is ${Math.ceil(bytes / 1024)} KB; at most ${COMPOSITION_BUDGET_BYTES / 1024} KB of JS plus assets`,
    );
  process.exit(1);
}
console.log(`✓ no composition over ${COMPOSITION_BUDGET_BYTES / 1024} KB`);
