import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

test("at touch width the windows stack in one column and the bar shows numbers at 40px", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const bar = await page.locator("header.bar").boundingBox();
  expect(bar?.height).toBe(40);
  // numbers only: the names are not shown
  const names = page.locator(".ws .name");
  await expect(names).toHaveCount(5);
  for (const name of await names.all()) await expect(name).toBeHidden();

  const boxes = await page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, width: r.width, top: r.top };
      }),
  );
  expect(boxes).toHaveLength(3);
  // one column: every window has the same left edge and width
  expect(new Set(boxes.map((b) => Math.round(b.left))).size).toBe(1);
  expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
});

test("a swipe moves one step, by native scroll-snap", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const snap = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollSnapType,
  );
  expect(snap).toContain("y");
  // scrolling the document by one screen lands on the next step
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight, behavior: "instant" }),
  );
  await expect(page.locator("main.area")).toHaveAttribute("data-step", "1");
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 5, behavior: "instant" }),
  );
  await expect(page.locator("main.area")).toHaveAttribute("data-step", "5");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "2",
  );
});

test("tapping a number jumps to its workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.locator(".ws button").nth(4).tap();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "4",
  );
  await expect(page.locator(".ws button").nth(4)).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a featured project is copy, then composition, then stack", async ({
  page,
}) => {
  await page.goto("/work/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const order = await page.$$eval(
    '[data-window="copy-1"], [data-window="comp-1"], [data-window="stack"]',
    (els) =>
      els
        .map((e) => ({
          id: (e as HTMLElement).dataset.window,
          top: e.getBoundingClientRect().top,
        }))
        .sort((a, b) => a.top - b.top)
        .map((e) => e.id),
  );
  expect(order).toEqual(["copy-1", "comp-1", "stack"]);
});

test("no hover tooltips and no clock on touch, before or after interaction", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  // before any interaction: the four are written out without key labels, the fifth is not shown
  await page.waitForTimeout(1200);
  const four = page.locator(".tg .tip");
  await expect(four).toHaveCount(4);
  for (const tip of await four.all()) {
    await expect(tip).toBeVisible();
    await expect(tip).toHaveCSS("opacity", "1");
    await expect(tip.locator("kbd")).toBeHidden();
  }
  await expect(page.locator(".ws .tip")).toBeHidden();
  await page.touchscreen.tap(200, 400);
  await expect(page.locator("[data-clock]")).toBeHidden();
  for (const tip of await page.locator(".tip").all())
    await expect(tip).toBeHidden();
});

test("a featured project is tiled 34 / 48 / 18, and the stack scrolls under its label band", async ({
  page,
}) => {
  await page.goto("/work/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(1100);
  const heights = await page.$$eval(
    '[data-window="copy-1"], [data-window="comp-1"], [data-window="stack"]',
    (els) => {
      const total = els.reduce(
        (sum, e) => sum + e.getBoundingClientRect().height,
        0,
      );
      return els.map((e) =>
        Math.round((e.getBoundingClientRect().height / total) * 100),
      );
    },
  );
  expect(heights).toEqual([34, 48, 18]);

  const stack = page.locator("[data-stack]");
  const band = page.locator('[data-window="stack"] .label');
  expect(
    await band.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  // too short for every row: it scrolls, and the last row comes clear of the band
  expect(await stack.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(
    true,
  );
  await stack.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  const bandBottom = (await band.boundingBox())?.y ?? 0;
  const bandBox = await band.boundingBox();
  const last = await page.locator("#archive-stack").boundingBox();
  const win = await page.locator('[data-window="stack"] .win').boundingBox();
  expect(last?.y ?? 0).toBeGreaterThanOrEqual(
    bandBottom + (bandBox?.height ?? 0) - 1,
  );
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(
    (win?.y ?? 0) + (win?.height ?? 0),
  );
  await page.locator("#archive-stack").scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-stack] a[data-position="1"]'),
  ).toHaveAttribute("aria-current", "true");
});

test("on touch the archive takes the whole workspace", async ({ page }) => {
  await page.goto("/archive/");
  const area = page.locator("main.area");
  await expect(area).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(1100);
  const shown = await page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window),
  );
  expect(shown).toEqual(["archive"]);
  const a = await page.locator('[data-window="archive"]').boundingBox();
  const m = await area.boundingBox();
  expect(Math.round(a?.width ?? 0)).toBe(Math.round(m?.width ?? 1));
  expect(Math.round(a?.height ?? 0)).toBe(Math.round(m?.height ?? 1));
  await page.locator(".close").click();
  await page.waitForTimeout(1100);
  await expect(page).toHaveURL(/\/work\/rapid-radiology\/$/);
});
