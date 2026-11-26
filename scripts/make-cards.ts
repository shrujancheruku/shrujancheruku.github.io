// Runs after `astro build`: Playwright captures every share card and draws the
// favicon into dist/ (#48). Nothing by hand: the cards are whatever the featured
// list holds (read from the built opening page's composition slots).
//
//   /cards/site.png       the opening workspace in its end state: no tooltips,
//                         no halo, CRT off
//   /cards/<slug>.png     a featured project's composition at its card frame
//   /cards/resume.png     the top of the resume's sheet
//   /favicon.png, /apple-touch-icon.png   `s_` in IBM Plex Mono, paper accent on paper
//
// Every card is 1200 × 630 in the paper theme. The server takes a free port.
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import {
  APPLE_ICON,
  CARD_HEIGHT,
  CARD_WIDTH,
  FAVICON,
  projectCardPath,
  RESUME_CARD,
  SITE_CARD,
} from "../src/lib/share";
import { THEMES } from "../src/lib/themes";
import { DIST, serveDist } from "./serve-dist";

const paper = THEMES.paper;
const out = (path: string): string => join(DIST, path);

const opening = await readFile(join(DIST, "index.html"), "utf8");
const featured = [...opening.matchAll(/data-composition="([^"]+)"/g)].map(
  (m) => m[1] as string,
);
if (featured.length === 0) {
  console.error("✗ no composition slot in dist/index.html: no cards to make");
  process.exit(1);
}

await mkdir(out("cards"), { recursive: true });
const server = serveDist();
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  // a card is always paper, whatever the machine remembers
  await context.addInitScript(() => {
    localStorage.setItem("theme", "paper");
    localStorage.setItem("crt", "off");
  });

  // ---- the site's card
  {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-01-01T09:41:00"));
    await page.goto(`${base}/`);
    await page.locator("main.area[data-ready=true]").waitFor();
    // the terminal's end state: the last reply typed
    await page
      .locator('[data-window="term"] .reply', {
        hasText: "Give me a problem, not a spec.",
      })
      .waitFor({ timeout: 15000 });
    // no staircase of tooltips, no halo: both are `body.idle`
    await page.evaluate(() => {
      document.body.classList.remove("idle");
      document.querySelector(".halo")?.classList.remove("halo");
    });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(SITE_CARD) });
    await page.close();
  }

  // ---- each featured project's card
  for (const repository of featured) {
    const page = await context.newPage();
    await page.goto(`${base}/work/${repository.toLowerCase()}/`);
    const slot = page.locator(`[data-slot][data-composition="${repository}"]`);
    await slot.and(page.locator('[data-mounted="true"]')).waitFor({
      timeout: 15000,
    });
    await slot.evaluate((el) => {
      (el as HTMLElement).dataset.frame = "card";
    });
    await page
      .locator(`[data-composition="${repository}"][data-state="frame"]`)
      .waitFor();
    // the scene alone, filling the card: nothing of the desktop around it
    await slot.evaluate((el) => document.body.append(el));
    await page.addStyleTag({
      content: `body{background:var(--bg)}body>*:not([data-slot]){display:none!important}[data-slot][data-composition="${repository}"]{position:fixed!important;inset:0!important;z-index:9999!important;container-type:size}`,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(projectCardPath(repository)) });
    await page.close();
  }

  // ---- the resume's card: the top of the sheet, filling the width
  {
    const page = await context.newPage();
    await page.goto(`${base}/resume/`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: `.screen-only{display:none!important}body{margin:0}`,
    });
    await page.evaluate((width) => {
      const sheet = document.querySelector<HTMLElement>(".sheet");
      if (!sheet) throw new Error("no .sheet on /resume/");
      document.documentElement.style.background = "#fff";
      document.body.style.background = "#fff";
      sheet.style.margin = "0";
      sheet.style.boxShadow = "none";
      (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom =
        String(width / sheet.getBoundingClientRect().width);
    }, CARD_WIDTH);
    await page.screenshot({ path: out(RESUME_CARD) });
    await page.close();
  }

  // ---- the favicon: `s_` in Plex Mono, the paper accent on the paper background
  for (const [path, size] of [
    [FAVICON, 64],
    [APPLE_ICON, 180],
  ] as const) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.goto(`${base}/404.html`);
    await page.evaluate(
      ({ size, bg, ac }) => {
        document.body.replaceChildren();
        document.body.className = "";
        document.body.style.cssText = `margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${bg};display:grid;place-items:center`;
        const s = document.createElement("span");
        s.textContent = "s_";
        s.style.cssText = `font:700 ${size * 0.62}px/1 "IBM Plex Mono";color:${ac};letter-spacing:-0.04em`;
        document.body.append(s);
      },
      { size, bg: paper.bg, ac: paper.ac },
    );
    await page.evaluate(() => document.fonts.load('700 20px "IBM Plex Mono"'));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out(path) });
    await page.close();
  }

  console.log(
    `✓ made ${featured.length + 2} share cards (${CARD_WIDTH} × ${CARD_HEIGHT}, paper) and the favicon`,
  );
} finally {
  await browser.close();
  await server.stop(true);
}
