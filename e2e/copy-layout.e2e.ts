// The copy window's layout on a wide screen (#160): with the archive shut the
// stack is as tall as its rows and a featured project's copy takes the rest of
// the column, its type stepping down only when the copy window is short. With
// the archive open the workspace keeps the 62/38 tiling, squeezed into the
// left 42%.
import { expect, type Page, test } from "@playwright/test";
import { STACK_ROW, stackHeight } from "../src/lib/workspaces";
import { area, ready, settle } from "./helpers";

const PROJECTS = ["issho", "rapid-radiology", "orca-flow", "unmacos"];
/** The stack's height: four featured projects and the archive line. */
const STACK = stackHeight(PROJECTS.length + 1);

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
  // four featured projects and the archive line, each row STACK_ROW tall
  expect(near(m.stack.height, STACK)).toBe(true);
  const rows = await page
    .locator(".stack > *")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(rows).toHaveLength(PROJECTS.length + 1);
  for (const row of rows) expect(near(row, STACK_ROW, 0.5)).toBe(true);
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

test("the stack stays put and the same height from one project to the next", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/work/");
  const before = await measure(page, 1);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  const after = await measure(page, 2);
  // to a twentieth of a pixel: the same percentages can snap a layout unit
  // (1/64px) apart at boot
  for (const pane of ["stack", "copy"] as const) {
    for (const side of ["top", "height", "width", "left"] as const) {
      expect(after[pane][side], `${pane} ${side}`).toBeCloseTo(
        before[pane][side],
        1,
      );
    }
  }
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

test("at 1280x720 the copy window scrolls", async ({ page }) => {
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

/** The copy window's height as a window: its pane, as #141 measured it. */
const copyPane = (page: Page, n: number) =>
  page
    .locator(`.pane[data-window="copy-${n}"]`)
    .evaluate((el) => el.getBoundingClientRect().height);

test("the type steps down only when the copy window is under 620px tall", async ({
  page,
}) => {
  // 1280x800: the copy window is under 620px, compact type
  await ready(page, "/work/");
  expect(await copyPane(page, 1)).toBeLessThan(620);
  expect(await pitchSize(page, 1)).toBe("15px");
  // either side of the threshold: at 1440x950 the window is just under
  // 620px, compact type
  await page.setViewportSize({ width: 1440, height: 950 });
  await settle(page);
  const under = await copyPane(page, 1);
  expect(under).toBeLessThan(620);
  expect(under).toBeGreaterThanOrEqual(602);
  expect(await pitchSize(page, 1)).toBe("15px");
  // at 1440x970 the window is 620px or more though its body is under 620px,
  // full size
  await page.setViewportSize({ width: 1440, height: 970 });
  await settle(page);
  const over = await copyPane(page, 1);
  expect(over).toBeGreaterThanOrEqual(620);
  expect(over).toBeLessThan(638);
  expect(await pitchSize(page, 1)).toBe("16px");
  // 1728x1000: well over, full size
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
        near(m.stack.height, STACK) &&
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

test("with the archive open the layout is the 62/38 tiling: copy 62%, stack 38%, in the left 42%", async ({
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

// the full type with the archive open: it never steps down there, and under
// 460px only the gap and padding do
for (const [width, height, h2, gap, pad] of [
  [1280, 800, 28, "6px", ["18px", "14px"]],
  [1920, 1080, 28.03, "12px", ["28px", "22px"]],
] as const) {
  test(`with the archive open at ${width}x${height} the copy keeps the full type`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await ready(page, "/work/");
    await page.locator("#archive-stack").click();
    await settle(page);
    await expect(area(page)).toHaveAttribute("data-open", "true");
    const style = await page
      .locator('.pane[data-window="copy-1"]')
      .evaluate((pane) => {
        const of = (s: string) => {
          const el = pane.querySelector(s);
          if (!el) throw new Error(`no ${s}`);
          return getComputedStyle(el);
        };
        return {
          h2: Number.parseFloat(of("h2").fontSize),
          pitch: [of(".pitch").fontSize, of(".pitch").lineHeight],
          proof: [of(".proof").fontSize, of(".proof").lineHeight],
          gap: of(".copy").gap,
          pad: [of(".copy").paddingTop, of(".copy").paddingBottom],
        };
      });
    expect(style.h2).toBeCloseTo(h2, 1);
    expect(style.pitch).toEqual(["16px", "23.2px"]);
    expect(style.proof).toEqual(["13px", "20.8px"]);
    expect(style.gap).toBe(gap);
    expect(style.pad).toEqual([...pad]);
  });
}
