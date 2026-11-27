import { expect, test } from "@playwright/test";
import {
  areaBox,
  barItem,
  expectScreens,
  expectStep,
  expectWorkspace,
  goTo,
  PHONES,
  ready,
  settle,
  shown,
  stepOf,
} from "./desktop";

test.use(PHONES["Pixel 7"]);

test("at touch width the windows stack in one column and the bar shows numbers at 40px", async ({
  page,
}) => {
  await ready(page, "/");
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
  await ready(page, "/");
  const css = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    return { snap: html.scrollSnapType, action: html.touchAction };
  });
  expect(css.snap).toBe("none");
  expect(css.action).toBe("pinch-zoom");
  await page.keyboard.press("ArrowDown");
  await expectStep(page, await stepOf(page, "timeline"));
});

test("tapping a number jumps to its workspace", async ({ page }) => {
  await ready(page, "/");
  await goTo(page, "contact", "tap");
  await expectWorkspace(page, "contact");
  await expect(await barItem(page, "contact")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a featured project is one screen: its copy over its composition, no stack", async ({
  page,
}) => {
  await ready(page, "/work/");
  await expectScreens(page, 1);
  const stacked = () =>
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
  await expect.poll(stacked).toEqual(["copy-1", "comp-1"]);
});

test("no hover tooltips and no clock on touch, before or after interaction", async ({
  page,
}) => {
  await ready(page, "/");
  // before any interaction: no tooltip is written out on a phone, none has keys to name
  await settle(page);
  await expect(page.locator(".tg .tip")).toHaveCount(4);
  for (const tip of await page.locator(".tip").all())
    await expect(tip).toBeHidden();
  await page.touchscreen.tap(200, 400);
  await expect(page.locator("[data-clock]")).toBeHidden();
  for (const tip of await page.locator(".tip").all())
    await expect(tip).toBeHidden();
});

test("on touch the archive takes the whole workspace", async ({ page }) => {
  await ready(page, "/archive/");
  await settle(page);
  expect(await shown(page)).toEqual(["archive"]);
  const a = await page.locator('[data-window="archive"]').boundingBox();
  const m = await areaBox(page);
  expect(Math.round(a?.width ?? 0)).toBe(Math.round(m?.width ?? 1));
  expect(Math.round(a?.height ?? 0)).toBe(Math.round(m?.height ?? 1));
  await page.locator(".close").click();
  await settle(page);
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
});
