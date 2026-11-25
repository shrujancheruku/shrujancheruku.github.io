// PROTOTYPE — throwaway. Ticket "How hero images and screenshots are made".
// Tries every candidate way of producing a featured project's imagery on two
// real projects: issho (has a live site) and orca-flow (has none).
// Run: bun install && bun capture.ts   → writes ./out/<project>/*
// Then: bun run view                    → http://localhost:4517
import { chromium, type Browser } from "playwright";
import { mkdir, writeFile, copyFile, readdir, rename, rm, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
const dataUrl = (f: string) => `data:image/${f.endsWith(".svg") ? "svg+xml" : "png"};base64,${readFileSync(f).toString("base64")}`;
import { homedir } from "node:os";

const OUT = new URL("./out/", import.meta.url).pathname;
const cached = `${homedir()}/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

// The per-project recipe: this is the shape a real content folder would carry.
const projects = [
  {
    slug: "issho",
    pitch: "Find your people through the things you already love.",
    language: "Go",
    live: "https://joinissho.com",
    social: "https://opengraph.githubassets.com/1/shrujancheruku/issho",
  },
  {
    slug: "orca-flow",
    pitch: "Turn a backlog of issues into reviewed, merged pull requests.",
    language: "Python",
    live: null,
    social: "https://opengraph.githubassets.com/1/shrujancheruku/orca-flow",
    pr: "https://github.com/shrujancheruku/issho/pull/628",
    readmeArt: `${homedir()}/code/orca-flow/docs/images`,
  },
] as const;

const fonts = `<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">`;
const base = `*{box-sizing:border-box;margin:0;padding:0}body{background:#1a1b26;color:#c0caf5;font-family:'JetBrains Mono',monospace;-webkit-font-smoothing:antialiased}`;

// A generated card: name, pitch, language. Stands in for Satori/Takumi output.
const cardHtml = (p: { slug: string; pitch: string; language: string }, shots: string[] = []) => `<!doctype html>${fonts}<style>${base}
body{width:1200px;height:630px;padding:44px;display:grid;grid-template-rows:auto 1fr auto;position:relative;overflow:hidden}
.bar{display:flex;justify-content:space-between;font-size:18px;padding:10px 16px;background:#2a2e44;border-radius:8px}
.bar b{color:#7aa2f7}
h1{font-size:${shots.length ? 92 : 132}px;font-weight:800;letter-spacing:-.05em;line-height:.95;align-self:center;max-width:${shots.length ? "560px" : "none"}}
h1 small{display:block;font:italic 400 ${shots.length ? 34 : 44}px/1.15 'Instrument Serif',serif;letter-spacing:0;color:#7aa2f7;margin-top:22px;max-width:${shots.length ? "520px" : "900px"}}
.ft{display:flex;justify-content:space-between;font-size:18px;opacity:.7}
.shot{position:absolute;right:-60px;top:120px;width:640px;border:2px solid #7aa2f7;border-radius:10px;box-shadow:0 30px 80px #000a;transform:rotate(-2deg)}
.shot.m{right:470px;top:300px;width:150px;transform:rotate(3deg)}
</style><div class="bar"><span><b>~/work/</b>${p.slug}</span><span>shrujancheruku.github.io</span></div>
<h1>${p.slug}<small>${p.pitch}</small></h1>
<div class="ft"><span>${p.language}</span><span>Shrujan Cheruku · product engineer</span></div>
${shots[0] ? `<img class="shot" src="${shots[0]}">` : ""}${shots[1] ? `<img class="shot m" src="${shots[1]}">` : ""}`;

// A terminal capture rendered from a transcript (text taken from orca-flow's own README art).
const C = { c: "#7dcfff", w: "#c0caf5", d: "#737aa2", y: "#e0af68", g: "#9ece6a" };
export const transcript: [keyof typeof C, boolean, string][] = [
  ["g", true, "❯ /flow:build #42"],
  ["c", true, "flow · #42 · coordinator working · run_7c41 · read 2s ago"],
  ["w", false, ""],
  ["w", true, "Coordinator"],
  ["w", false, "  #46 passed its check and is merged into integration/shared-playlists-v1 (4 of 9)."],
  ["w", false, "  #45 is with the checker now. #51 touches packages/records, so it went to Opus."],
  ["w", false, ""],
  ["w", true, "In progress (4)"],
  ["w", false, "  #51 build opus   1h04m"],
  ["w", false, "  #47 build sonnet 38m"],
  ["w", false, "  #49 build haiku  12m"],
  ["w", false, "  #45 check haiku  3m"],
  ["d", false, "Playlists v1: 4/9 integrated, 3 in progress, 1 ready next, 0 blocked, 1 waiting on you"],
  ["w", false, ""],
  ["y", true, "Questions from the coordinator (1)"],
  ["w", false, "  1) [a3f1] Ticket #50 says removed playlists are archived, the spec says deleted."],
  ["w", false, "     Which one do you want? — reply here"],
  ["w", false, ""],
  ["g", true, "✓ PR #53 ready: 9 tickets closed, checks green, up to date with main"],
];
const termHtml = `<!doctype html>${fonts}<style>${base}
body{width:1600px;height:1000px;padding:28px;display:grid;grid-template-rows:auto 1fr;gap:14px}
.bar{display:flex;justify-content:space-between;font-size:17px;padding:9px 16px;background:#2a2e44;border-radius:8px}.bar b{color:#7aa2f7}
.win{border:2px solid #7aa2f7;border-radius:10px;padding:34px 38px;font-size:23px;line-height:1.72;white-space:pre;overflow:hidden}
</style><div class="bar"><span><b>3</b> orca-flow — zsh</span><span>flow.py watch</span></div><div class="win">${transcript
  .map(([c, b, t]) => `<div style="color:${C[c]};font-weight:${b ? 700 : 400}">${t || " "}</div>`)
  .join("")}</div>`;

async function shot(b: Browser, o: { url?: string; html?: string; path: string; w: number; h: number; scale?: number; full?: boolean; mobile?: boolean; sel?: string; css?: string }) {
  const ctx = await b.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.scale ?? 2, isMobile: o.mobile, hasTouch: o.mobile, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  if (o.url) await page.goto(o.url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  else await page.setContent(o.html!, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  if (o.full) {
    // scroll through once so lazy and scroll-revealed content is present
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } scrollTo(0, 0); });
    await page.waitForTimeout(600);
  }
  if (o.css) await page.addStyleTag({ content: o.css });
  if (o.sel) await page.locator(o.sel).screenshot({ path: o.path });
  else await page.screenshot({ path: o.path, fullPage: o.full });
  await ctx.close();
}

async function scrollVideo(b: Browser, url: string, dir: string, name: string) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const end = document.body.scrollHeight - innerHeight, t0 = performance.now(), dur = Math.min(14000, Math.max(5000, end * 3));
    await new Promise<void>(r => { const f = (t: number) => { const k = Math.min(1, (t - t0) / dur); scrollTo(0, end * (k < .5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k))); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
  });
  await page.waitForTimeout(800);
  const v = page.video()!;
  await ctx.close();
  await rename(await v.path(), `${dir}/${name}`);
}

const b = await chromium.launch(existsSync(cached) ? { executablePath: cached } : {});
for (const p of projects) {
  const dir = `${OUT}${p.slug}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  console.log(`\n${p.slug}`);

  // 1. reuse the social preview
  await writeFile(`${dir}/social-github.png`, Buffer.from(await (await fetch(p.social)).arrayBuffer()));

  // 2. automated screenshots of the live homepage
  if (p.live) {
    await shot(b, { url: p.live, path: `${dir}/live-desktop.png`, w: 1440, h: 900 });
    await shot(b, { url: p.live, path: `${dir}/live-full.png`, w: 1440, h: 900, scale: 1, full: true });
    await shot(b, { url: p.live, path: `${dir}/live-mobile.png`, w: 390, h: 844, scale: 3, mobile: true });
    await scrollVideo(b, p.live, dir, "live-scroll.webm");
  }

  // 3. generated card (also the share card for /work/<slug>/)
  await shot(b, { html: cardHtml(p), path: `${dir}/card.png`, w: 1200, h: 630 });

  // 4. captures for a tool with nothing to screenshot
  if ("readmeArt" in p) {
    for (const f of ["hero.svg", "console.svg", "routing.svg"])
      await shot(b, { html: `<body style="margin:0;background:#0b1220"><img style="display:block;width:1400px" src="${dataUrl(`${p.readmeArt}/${f}`)}">`, sel: "img", path: `${dir}/readme-${f.replace(".svg", ".png")}`, w: 1400, h: 800 });
    await copyFile(`${p.readmeArt}/profile.png`, `${dir}/readme-profile.png`);
    await shot(b, { html: termHtml, path: `${dir}/terminal.png`, w: 1600, h: 1000 });
    await shot(b, { url: p.pr, path: `${dir}/pull-request.png`, w: 1440, h: 900, css: ".js-header-wrapper,header[role=banner]{display:none!important}" });
  }
  for (const f of await readdir(dir)) console.log(`  ${f.padEnd(24)} ${Math.round((await stat(`${dir}/${f}`)).size / 1024)} KB`);
}
// 5. bake each per-project composition (compositions/<slug>.html) to a share card. Needs `bun run view` running.
for (const slug of ["issho", "orca-flow", "unmacos", "rapid-radiology"]) {
  await mkdir(`${OUT}${slug}`, { recursive: true });
  await shot(b, { url: `http://localhost:4517/compositions/${slug}.html?card=1`, path: `${OUT}${slug}/comp-card.png`, w: 1200, h: 630 });
}
await b.close();
await writeFile(`${OUT}transcript.json`, JSON.stringify(transcript.map(([c, b, t]) => [C[c], b, t])));
