// The copy window's layout on a wide screen (#160): with the archive shut the
// stack is as tall as its rows and a featured project's copy takes the rest of
// the column, its type stepping down only when the copy window is short. With
// the archive open the workspace is today's, squeezed into the left 42%.
import { expect, type Page, test } from "@playwright/test";
import { area, ready, settle } from "./helpers";

const PROJECTS = ["issho", "rapid-radiology", "orca-flow", "unmacos"];

/** The heights the desktop gives the stack and copy panes, and the area's box, in px. */
const measure = (page: Page, n: number) =>
  page.evaluate((n) => {
    const box = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) throw new Error(`no ${sel}`);
      return el.getBoundingClientRect();
    };
    const a = box("main.area");
    const copy = box(`.pane[data-window="copy-${n}"]`);
    const stack = box('.pane[data-window="stack"]');
    const comp = box(`.pane[data-window="comp-${n}"]`);
    return {
      area: { top: a.top, height: a.height, width: a.width, left: a.left },
      copy: {
        top: copy.top,
        height: copy.height,
        width: copy.width,
        left: copy.left,
      },
      stack: {
        top: stack.top,
        height: stack.height,
        width: stack.width,
        left: stack.left,
      },
      comp: { width: comp.width, left: comp.left },
    };
  }, n);

/** How far the copy of project `n` runs past its window, in px (0 when it shows whole). */
const overflow = (page: Page, n: number) =>
  page
    .locator(`.pane[data-window="copy-${n}"] .copy`)
    .evaluate((el) => el.scrollHeight - el.clientHeight);

const pitchSize = (page: Page, n: number) =>
  page
    .locator(`.pane[data-window="copy-${n}"] .pitch`)
    .evaluate((el) => getComputedStyle(el).fontSize);

const near = (a: number, b: number, by = 1) => Math.abs(a - b) <= by;

test("the stack is as tall as its rows and the copy takes the rest of the column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/work/");
  const m = await measure(page, 1);
  // four featured projects and the archive line: 204px
  expect(near(m.stack.height, 204)).toBe(true);
  expect(near(m.stack.top + m.stack.height, m.area.top + m.area.height)).toBe(
    true,
  );
  expect(near(m.copy.top, m.area.top)).toBe(true);
  expect(near(m.copy.height + m.stack.height, m.area.height)).toBe(true);
  // the column stays 30% and the composition 70%
  expect(m.copy.width / m.area.width).toBeCloseTo(0.3, 2);
  expect(m.stack.width / m.area.width).toBeCloseTo(0.3, 2);
  expect(m.comp.width / m.area.width).toBeCloseTo(0.7, 2);
});

test("the stack stays put and 204px from one project to the next", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/work/");
  const before = await measure(page, 1);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  const after = await measure(page, 2);
  expect(after.stack).toEqual(before.stack);
  expect(after.copy).toEqual(before.copy);
});

for (const [width, height] of [
  [1280, 800],
  [1440, 900],
  [1728, 1000],
  [1920, 1080],
] as const) {
  test(`wide fit: at ${width}x${height} every featured project's copy shows whole`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await ready(page, "/work/");
    await page.evaluate(() => document.fonts.ready);
    for (const [i, name] of PROJECTS.entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowDown");
        await settle(page);
      }
      await expect(
        page.locator(`.pane[data-window="copy-${i + 1}"] h2`),
      ).toHaveText(name);
      const m = await measure(page, i + 1);
      // for the report: the stack's and the copy window's heights here
      test.info().annotations.push({
        type: "heights",
        description: `${width}x${height} ${name}: stack ${m.stack.height}px, copy ${m.copy.height}px`,
      });
      expect(await overflow(page, i + 1), name).toBeLessThanOrEqual(0);
    }
  });
}

test("at 1280x720 the copy window scrolls, as it does today", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page, "/work/");
  await page.evaluate(() => document.fonts.ready);
  expect(await overflow(page, 1)).toBeGreaterThan(0);
  expect(
    await page
      .locator('.pane[data-window="copy-1"] .copy')
      .evaluate((el) => getComputedStyle(el).overflowY),
  ).toBe("auto");
});

test("the type steps down only when the copy window is under 620px tall", async ({
  page,
}) => {
  // 1280x800: the copy window is under 620px, compact type
  await ready(page, "/work/");
  expect(await pitchSize(page, 1)).toBe("15px");
  // 1728x1000: 620px or more, full size
  await page.setViewportSize({ width: 1728, height: 1000 });
  await settle(page);
  expect(await pitchSize(page, 1)).toBe("16px");
});

test("resizing re-resolves the stack's height, with no motion at rest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/work/");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect
    .poll(async () => {
      const m = await measure(page, 1);
      return (
        near(m.stack.height, 204) &&
        near(m.copy.height + m.stack.height, m.area.height)
      );
    })
    .toBe(true);
  await expect(area(page)).toHaveAttribute("data-retiling", "false");
  const style = await page
    .locator('.pane[data-window="copy-1"]')
    .evaluate((e) => (e as HTMLElement).style.transform);
  expect(style).toBe("");
});

test("with the archive open the layout is today's: copy 62%, stack 38%, in the left 42%", async ({
  page,
}) => {
  await ready(page, "/work/");
  await page.locator("#archive-stack").click();
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-open", "true");
  const m = await measure(page, 1);
  expect(m.copy.width / m.area.width).toBeCloseTo(0.3 * 0.42, 2);
  expect(m.copy.height / m.area.height).toBeCloseTo(0.62, 2);
  expect(m.stack.height / m.area.height).toBeCloseTo(0.38, 2);
  expect(near(m.stack.top, m.copy.top + m.copy.height)).toBe(true);
});
