// PROTOTYPE helper: captures the issho site as two full-page stills, light and dark, for the issho composition.
// Run from prototype/hero-images (it has Playwright): bun ../compositions/capture-site.ts
import { chromium } from "playwright";
import { join } from "node:path";
const b = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  await p.goto("https://joinissho.com", { waitUntil: "networkidle", timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await p.waitForTimeout(800);
  console.log(scheme, await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.className, getComputedStyle(document.body).backgroundColor, document.body.scrollHeight].join(" | ")));
  await p.screenshot({ path: join(import.meta.dir, `src/issho/site-${scheme}.png`), fullPage: true });
  await p.close();
}
await b.close();
