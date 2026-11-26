// PROTOTYPE helper: measure overflow of each copy window per layout/viewport
import { chromium } from "@playwright/test";
const layouts = (process.argv[2] ?? "").split(",");
const shot = process.argv[3];
const sizes = [[1280,720],[1280,800],[1440,900],[1728,1000],[1920,1080],[2560,1440]];
const slugs = ["issho","rapid-radiology","orca-flow","unmacos"];
const b = await chromium.launch();
for (const L of layouts) {
  console.log(`== layout ${L || "(none)"}`);
  for (const [w,h] of sizes) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const row = [];
    for (const s of slugs) {
      await p.goto(`http://localhost:4377/work/${s}/?copy=C${L ? `&layout=${L}` : ""}`);
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const c = [...document.querySelectorAll('[data-window^="copy-"]')].find(e => e.style.display !== "none")?.querySelector(".copy");
        if (!c) return null;
        const pane = c.closest(".pane").getBoundingClientRect();
        const st = document.querySelector('[data-window="stack"] .stack');
        return { over: c.scrollHeight - c.clientHeight, w: Math.round(pane.width), h: Math.round(pane.height),
          slack: Math.round(c.querySelector(".facts").getBoundingClientRect().top - c.querySelector(".proof").getBoundingClientRect().bottom),
          stackOver: st ? st.scrollHeight - st.clientHeight : 0 };
      });
      row.push(r ? `${s.slice(0,5)}:${r.over > 0 ? "OVER+" + r.over : "ok(" + r.slack + ")"}${r.stackOver > 0 ? "!stack+" + r.stackOver : ""}` : `${s}:?`);
      if (shot && w === 1440) await p.screenshot({ path: `${shot}/${L || "none"}-${s}.png` });
      if (s === "issho") row.unshift(`pane ${r?.w}x${r?.h}`);
    }
    console.log(`${w}x${h}  ${row.join("  ")}`);
    await p.close();
  }
}
await b.close();
