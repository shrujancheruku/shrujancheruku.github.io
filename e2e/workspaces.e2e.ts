import { expect, type Page, test } from "@playwright/test";

const NAMES = ["opening", "projects", "timeline", "sabbatical", "contact"];

const area = (page: Page) => page.locator("main.area");
const current = async (page: Page) => ({
  step: Number(await area(page).getAttribute("data-step")),
  workspace: Number(await area(page).getAttribute("data-workspace")),
});
/** The windows on show, by id. */
const shown = (page: Page) =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window)
      .sort(),
  );
const settle = (page: Page) => page.waitForTimeout(1100);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
});

test("boots on the opening workspace with its three windows", async ({
  page,
}) => {
  expect(await current(page)).toEqual({ step: 0, workspace: 0 });
  expect(await shown(page)).toEqual(["name", "now", "term"]);
});

test("wheel scrolling moves one step at a time through all five workspaces", async ({
  page,
}) => {
  // sixteen settles alone are 17.6 s, and each of the 112 wheel events waits for a frame
  test.setTimeout(60_000);
  await page.mouse.move(640, 400);
  const seen: number[] = [];
  for (let i = 0; i < 4 + 4; i++) {
    // a trackpad-like flick: a burst of events that tails off
    for (let d = 120; d > 4; d = Math.floor(d * 0.8)) {
      await page.mouse.wheel(0, d);
      await page.waitForTimeout(16);
    }
    await settle(page);
    seen.push((await current(page)).workspace);
  }
  // 4 featured projects + 4 other workspaces = 8 steps; the last flick has nowhere to go
  expect(seen).toEqual([1, 1, 1, 1, 2, 3, 4, 4]);

  // over the status bar, not the timeline window, which scrolls its own content first
  const bar = await page.locator("header.bar").boundingBox();
  await page.mouse.move(640, (bar?.y ?? 0) + (bar?.height ?? 0) / 2);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -120);
    await settle(page);
  }
  expect(await current(page)).toEqual({ step: 0, workspace: 0 });
});

test("keyboard scrolling moves one step at a time", async ({ page }) => {
  const steps: number[] = [];
  for (const key of ["ArrowDown", "PageDown", "Space", "ArrowUp", "PageUp"]) {
    await page.keyboard.press(key);
    await settle(page);
    steps.push((await current(page)).step);
  }
  expect(steps).toEqual([1, 2, 3, 2, 1]);
});

test("number keys jump to a workspace, and are ignored with a modifier held", async ({
  page,
}) => {
  for (const [key, ws] of [
    ["3", 2],
    ["5", 4],
    ["1", 0],
    ["4", 3],
    ["2", 1],
  ] as const) {
    await page.keyboard.press(key);
    await settle(page);
    expect((await current(page)).workspace).toBe(ws);
  }
  await page.keyboard.press("Meta+4");
  await page.keyboard.press("Control+5");
  await page.keyboard.press("Alt+3");
  await settle(page);
  expect((await current(page)).workspace).toBe(1);
});

test("each workspace shows exactly its windows", async ({ page }) => {
  const model = await page.$eval("#desktop-model", (e) =>
    JSON.parse(e.textContent ?? "[]"),
  );
  let step = 0;
  for (const [wi, w] of model.entries()) {
    for (const s of w.steps) {
      await page.keyboard.press(
        wi === 1 && step > 0 ? "ArrowDown" : String(wi + 1),
      );
      await settle(page);
      expect(await shown(page)).toEqual(Object.keys(s.desktop).sort());
      await expect(page.locator(`[data-window="${s.focus}"]`)).toHaveClass(
        /focus/,
      );
      step++;
    }
  }
  expect(step).toBe(8);
});

test("the status bar lists the numbers with names and marks the current workspace", async ({
  page,
}) => {
  const buttons = page.locator(".ws button");
  await expect(buttons).toHaveCount(5);
  for (const [i, name] of NAMES.entries()) {
    await expect(buttons.nth(i)).toContainText(`${i + 1} ${name}`);
  }
  await expect(buttons.nth(0)).toHaveAttribute("aria-current", "true");
  await buttons.nth(3).click();
  await settle(page);
  expect((await current(page)).workspace).toBe(3);
  await expect(buttons.nth(3)).toHaveAttribute("aria-current", "true");
  await expect(buttons.nth(0)).not.toHaveAttribute("aria-current", "true");
});

test("windows animate between tilings, not cut", async ({ page }) => {
  const left = () =>
    page.$eval('[data-window="name"]', (e) => e.getBoundingClientRect().left);
  const before = await left();
  await page.keyboard.press("5");
  await page.waitForTimeout(150);
  const mid = await left();
  await settle(page);
  const after = await left();
  expect(before).toBeLessThan(mid);
  expect(mid).toBeLessThan(after);
});

test("windows arriving fade in rather than appearing", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const opacity = await page.$eval('[data-window="comp-1"]', (e) =>
    Number(getComputedStyle(e).opacity),
  );
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
});

test("windows have the decided gap, border, radius and focus gradient", async ({
  page,
}) => {
  const win = page.locator('[data-window="name"] .win');
  const pane = page.locator('[data-window="name"]');
  expect(await win.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe(
    "2px",
  );
  expect(
    await win.evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
  ).toBe("14px");
  // 14px gaps: 7px of padding on each pane, 7px of margin on the area
  expect(await pane.evaluate((e) => getComputedStyle(e).paddingLeft)).toBe(
    "7px",
  );
  // the focused window's border is a gradient; the unfocused one is flat
  expect(
    await win.evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("linear-gradient");
  const other = page.locator('[data-window="term"] .win');
  expect(await other.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(
    "none",
  );
});

test("a scrolling window's label sits on an opaque band", async ({ page }) => {
  await page.keyboard.press("3");
  await settle(page);
  const band = page.locator('[data-window="timeline"] .label');
  expect(
    await band.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  expect(await band.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  // and the label stays hidden where nothing scrolls under it (project copy)
  await expect(page.locator('[data-window="copy-1"] .label')).toHaveCount(0);
});

test("the production build ships all five workspaces from one model with steps inside", async ({
  page,
}) => {
  const model = await page.$eval("#desktop-model", (e) =>
    JSON.parse(e.textContent ?? "[]"),
  );
  expect(model.map((w: { id: string }) => w.id)).toEqual([
    "opening",
    "projects",
    "timeline",
    "sabbatical",
    "contact",
  ]);
  expect(model[1].steps.length).toBe(4);
});
