// PROTOTYPE helper: screenshots a list of [name, path, width, height, wait ms, keys?, js to run?] into a folder.
// No server: requests to http://proto.local/ are answered from the prototype folder on disk.
// Run from prototype/hero-images (it has Playwright): bun ../compositions/shoot.ts <out dir> '<json jobs>'
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
const root = join(import.meta.dir, ".."), out = process.argv[2], jobs = JSON.parse(process.argv[3]);
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const b = await chromium.launch();
for (const [name, path, w, h, wait, keys, js] of jobs) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route("http://proto.local/**", async r => {
    let f = decodeURIComponent(new URL(r.request().url()).pathname); if (f.endsWith("/")) f += "index.html";
    try { await r.fulfill({ body: await readFile(join(root, f)), contentType: TYPES[extname(f)] || "application/octet-stream" }); } catch { await r.fulfill({ status: 404, body: "" }); }
  });
  p.on("pageerror", e => console.log(name, "ERR", e.message));
  p.on("console", m => m.type() === "error" && console.log(name, "console", m.text()));
  await p.goto("http://proto.local/" + path); await p.waitForTimeout(wait);
  for (const k of keys || []) { await p.keyboard.press(k); await p.waitForTimeout(1200); }
  if (js) { await p.evaluate(js); await p.waitForTimeout(300); }
  await p.screenshot({ path: `${out}/${name}.png` }); await p.close();
}
await b.close();
