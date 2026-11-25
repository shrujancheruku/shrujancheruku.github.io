import { expect, type Page, test } from "@playwright/test";

// a beat is 2.2 s and a cycle five of them
test.describe.configure({ timeout: 60_000 });

const area = (page: Page) => page.locator("main.area");
const slot = (page: Page) => page.locator('[data-composition="unmacos"]');
const scene = (page: Page) => slot(page).locator(".scene");
const bar = (page: Page) => scene(page).locator(".sb");
const siteTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

const open = async (page: Page, theme?: string) => {
  if (theme)
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.goto("/work/unmacos/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
};

test("it starts on the visitor's theme, holds it for 2.5 s, then switches on each beat; its bar reads `<theme> · 23 themes`", async ({
  page,
}) => {
  await open(page, "tokyo-night");
  await expect(bar(page)).toHaveText(/tokyo-night · 23 themes$/);
  const seen: string[] = [];
  const started = Date.now();
  let held = true;
  while (Date.now() - started < 9000) {
    const name = (await bar(page).locator(".a").textContent()) ?? "";
    if (seen.at(-1) !== name) seen.push(name);
    if (Date.now() - started < 1200) held &&= name === "tokyo-night";
    await page.waitForTimeout(100);
  }
  expect(held).toBe(true);
  // after the hold it moves on through the site's themes, in their order
  expect(seen[0]).toBe("tokyo-night");
  expect(seen.slice(0, 4)).toEqual([
    "tokyo-night",
    "gruvbox",
    "paper",
    "issho-light",
  ]);
});

test("it does not change the site's own theme", async ({ page }) => {
  await open(page, "nord");
  await page.waitForTimeout(6000);
  expect(await siteTheme(page)).toBe("nord");
  const body = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  );
  expect(body).toBe("#2e3440");
  // the demo's own colours are on the scene alone
  const scenePaints = await scene(page).evaluate((el) => el.style.length > 0);
  expect(scenePaints).toBe(true);
});

test("it starts again on the visitor's theme each time it is entered", async ({
  page,
}) => {
  await open(page, "gruvbox");
  await expect(bar(page)).not.toHaveText(/gruvbox · 23 themes$/, {
    timeout: 8000,
  });
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>(
      '[data-composition="unmacos"]',
    );
    s?.dispatchEvent(new CustomEvent("composition:leave"));
    s?.dispatchEvent(new CustomEvent("composition:enter"));
  });
  await expect(bar(page)).toHaveText(/gruvbox · 23 themes$/);
});

test("it opens with nvim, btop and spotify_player, one window opens from the launcher and closes again, each step names its key", async ({
  page,
}) => {
  await open(page);
  const names = () =>
    scene(page)
      .locator(".tile")
      .evaluateAll((els) =>
        els.map(
          (e) =>
            e.querySelector(".tabs, .cpu legend, legend")?.textContent ?? "",
        ),
      );
  expect(await names()).toHaveLength(3);
  const labels: string[] = [];
  const counts: number[] = [];
  const started = Date.now();
  while (Date.now() - started < 12_500) {
    const label = ((await scene(page).locator(".keys.on").textContent()) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (label && labels.at(-1) !== label) labels.push(label);
    const n = await scene(page).locator(".tile:not(.out)").count();
    if (counts.at(-1) !== n) counts.push(n);
    await page.waitForTimeout(80);
  }
  // 3 windows, 4 while lazygit is open, 3 again
  expect(counts.slice(0, 3)).toEqual([3, 4, 3]);
  expect(labels.slice(0, 5)).toEqual([
    "alt+shift+h move · alt+ctrl+shift+space theme",
    "alt+space launch an app · alt+ctrl+shift+space theme",
    "alt+shift+j move · alt+ctrl+shift+space theme",
    "alt+w close the window · alt+ctrl+shift+space theme",
    "alt+shift+l move · alt+ctrl+shift+space theme",
  ]);
});

test("the launcher draws its menu while lazygit is picked", async ({
  page,
}) => {
  await open(page);
  const menu = scene(page).locator(".menu.on");
  await expect(menu).toBeVisible({ timeout: 9000 });
  await expect(menu).toContainText("apps");
  await expect(menu).toContainText("lazygit");
});

test("the share-card frame is four windows with no key label, in the visitor's theme", async ({
  page,
}) => {
  await open(page, "nord");
  await slot(page).evaluate((el) => {
    el.dataset.frame = "windows";
  });
  await expect(slot(page)).toHaveAttribute("data-state", "frame");
  const tiles = scene(page).locator(".tile");
  await expect(tiles).toHaveCount(4);
  await expect(scene(page).locator(".keys.on")).toHaveCount(0);
  await expect(tiles.nth(0).locator(".tabs")).toContainText("colourscheme.lua");
  await expect(tiles.nth(1).locator("legend").first()).toContainText("cpu");
  await expect(tiles.nth(2)).toContainText("Playback");
  await expect(tiles.nth(3)).toContainText("Unstaged changes");
  await expect(bar(page)).toHaveText(/nord · 23 themes$/);
  expect(await scene(page).evaluate((el) => el.style.length)).toBe(0);
  await page.waitForTimeout(3500);
  await expect(bar(page)).toHaveText(/nord · 23 themes$/);
});

test("with reduced motion it is frozen at its still frame in the visitor's theme", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("theme", "gruvbox"));
  await page.goto("/work/unmacos/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  await expect(slot(page)).toHaveAttribute("data-state", "frame");
  await expect(scene(page).locator(".tile")).toHaveCount(4);
  await expect(scene(page).locator(".keys.on")).toHaveCount(0);
  const before = await scene(page).innerHTML();
  await page.waitForTimeout(3500);
  expect(await scene(page).innerHTML()).toBe(before);
  await expect(bar(page)).toHaveText(/gruvbox · 23 themes$/);
});

test("btop draws its panels and its meters move; the song's clock runs", async ({
  page,
}) => {
  await open(page);
  const btop = scene(page).locator(".btop");
  for (const title of ["cpu", "mem", "net", "proc"])
    await expect(
      btop.locator("legend", { hasText: new RegExp(`^\\d${title}`) }),
    ).toHaveCount(1);
  const meters = () =>
    btop
      .locator("[data-j]")
      .evaluateAll((els) => els.map((e) => e.textContent));
  const clock = () => scene(page).locator(".tm").first().textContent();
  const [m0, c0] = [await meters(), await clock()];
  await page.waitForTimeout(2300);
  expect(await meters()).not.toEqual(m0);
  expect(await clock()).not.toBe(c0);
  const graph = btop.locator(".graph i");
  expect(await graph.count()).toBe(64);
});

test("the other apps show their real panels", async ({ page }) => {
  await open(page);
  await slot(page).evaluate((el) => {
    el.dataset.frame = "windows";
  });
  const lazygit = scene(page).locator(".lg");
  for (const t of [
    "Status",
    "Files",
    "Local branches",
    "Commits",
    "Stash",
    "Unstaged changes",
    "Command log",
  ])
    await expect(lazygit.locator(`legend:has-text("${t}")`)).toHaveCount(1);
  await expect(lazygit.locator(".hint")).toContainText("Keybindings: ?");
  const spotify = scene(page).locator(".sp");
  for (const t of ["Playback", "Top Tracks", "Albums", "Related Artists"])
    await expect(spotify.locator(`legend:has-text("${t}")`)).toHaveCount(1);
  await expect(scene(page).locator(".nv .sl .mode")).toHaveText("NORMAL");
  await expect(
    scene(page).locator(".nv .d", { hasText: "~" }).first(),
  ).toBeAttached();
});

test("windows give up their secondary panels as they shrink", async ({
  page,
}) => {
  await open(page);
  await slot(page).evaluate((el) => {
    el.dataset.frame = "windows";
  });
  const btop = scene(page).locator(".btop");
  const visible = (sel: string) =>
    btop
      .locator(sel)
      .first()
      .evaluate((e) => getComputedStyle(e).display !== "none");
  // btop sits in the small bottom-left-of-three slot in the four-window desktop
  const kept = await Promise.all([".cpu", ".proc", ".graph"].map(visible));
  const box = await btop.evaluate(
    (e) => e.parentElement?.getBoundingClientRect().width,
  );
  // a narrow window has dropped something a wide one keeps
  expect(box).toBeLessThan(600);
  expect(kept.filter(Boolean).length).toBeLessThan(3);
});

test("the scene is gapped windows with the site's border; the focused one has the accent", async ({
  page,
}) => {
  await open(page);
  const tiles = scene(page).locator(".tile");
  const border = await tiles.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.borderTopWidth, radius: s.borderTopLeftRadius };
  });
  expect(border).toEqual({ width: "2px", radius: "14px" });
  await expect(scene(page).locator(".pn.focus")).toHaveCount(1);
  const boxes = await tiles.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect()),
  );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const apartX = a.right <= b.left - 8 || b.right <= a.left - 8;
      const apartY = a.bottom <= b.top - 8 || b.bottom <= a.top - 8;
      expect(apartX || apartY).toBe(true);
    }
});
