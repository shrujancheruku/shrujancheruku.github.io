// Runs after `astro build`: fails when the opening workspace's first load is over
// 250 KB compressed or the fonts are over 100 KB in total (#48, #22). Prints both
// measured sizes either way, so CI's log shows them.
//
// The first load is what a fresh browser asks for until the window `load` event:
// the page, its CSS and JS and the fonts it uses. Each body is gzipped (what the
// host sends); an already-compressed file (a font) counts at the smaller of the
// two. Compositions and photos load later, so one found here fails too.
import { readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { compositions } from "../src/compositions/registry";
import { lazyInFirstLoad, loadBudgetReport } from "../src/lib/budgets";
import { DIST, serveDist } from "./serve-dist";

// the fonts the desktop ships; the resume sheet's own Fira faces are its own page's
const fontFiles = (await readdir(`${DIST}fonts`)).filter(
  (f) => f.endsWith(".woff2") && !f.startsWith("fira-"),
);
let fonts = 0;
for (const f of fontFiles) fonts += (await stat(`${DIST}fonts/${f}`)).size;

const server = serveDist();
const browser = await chromium.launch();
const requests: { url: string; bytes: number }[] = [];
try {
  const page = await (await browser.newContext()).newPage();
  const pending: Promise<void>[] = [];
  let loaded = false;
  page.on("response", (res) => {
    if (loaded || !res.url().startsWith(`http://localhost:${server.port}`))
      return;
    pending.push(
      res
        .body()
        .then((body) => {
          requests.push({
            url: new URL(res.url()).pathname,
            bytes: Math.min(gzipSync(body).length, body.length),
          });
        })
        .catch(() => {}),
    );
  });
  await page.goto(`http://localhost:${server.port}/`, { waitUntil: "load" });
  loaded = true;
  await Promise.all(pending);
} finally {
  await browser.close();
  await server.stop(true);
}

const firstLoad = requests.reduce((sum, r) => sum + r.bytes, 0);
const { lines, failures } = loadBudgetReport({ firstLoad, fonts });
const strays = lazyInFirstLoad(
  requests.map((r) => r.url),
  Object.keys(compositions),
);
for (const url of strays)
  failures.push(
    `${url} is in the first load; compositions and photos load later`,
  );

const loadedFonts = requests.filter((r) => r.url.endsWith(".woff2")).length;
console.log(
  `first load: ${requests.length} requests, ${loadedFonts} of ${fontFiles.length} fonts`,
);
for (const line of lines) console.log(line);
if (failures.length > 0) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log("✓ first load and fonts within budget");
