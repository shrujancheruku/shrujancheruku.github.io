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
  await expect(names).toHaveCount(6);
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

test("the page does not scroll on touch: a swipe is a step", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const css = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    return { snap: html.scrollSnapType, action: html.touchAction };
  });
  expect(css.snap).toBe("none");
  expect(css.action).toBe("pinch-zoom");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main.area")).toHaveAttribute("data-step", "1");
});

test("tapping a number jumps to its workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.locator(".ws button").nth(5).tap();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "5",
  );
  await expect(page.locator(".ws button").nth(5)).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a featured project is one screen: its copy over its composition, no stack", async ({
  page,
}) => {
  await page.goto("/work/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("main.area")).toHaveAttribute("data-screens", "1");
  const shown = () =>
    page.$$eval(
      '[data-window="copy-1"], [data-window="comp-1"], [data-window="stack"]',
      (els) =>
        els
          .filter((e) => getComputedStyle(e).display !== "none")
          .map((e) => ({
            id: (e as HTMLElement).dataset.window,
            top: e.getBoundingClientRect().top,
          }))
          .sort((a, b) => a.top - b.top)
          .map((e) => e.id),
    );
  await expect.poll(shown).toEqual(["copy-1", "comp-1"]);
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
