import { devices, expect, type Page, test } from "@playwright/test";
import {
  area,
  isOneScreen,
  ready,
  SWIPES,
  settle,
  swipeScreen,
  warmUpTouch,
  whereOf,
} from "./helpers";

// The window crossing the touch breakpoint (760px) and back, and a phone
// screen changing size: the onLayoutChange and remeasure paths of
// src/scripts/desktop.ts.

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const shown = (page: Page, id: string) =>
  page
    .locator(`[data-window="${id}"]`)
    .evaluate((e) => getComputedStyle(e).display !== "none");

/** The timeline entries on show, by index in the list. */
const timelineEntries = (page: Page) =>
  page.$$eval('[data-window="timeline"] [data-paged] > *', (items) =>
    items.flatMap((e, i) => ((e as HTMLElement).hidden ? [] : [i])),
  );

async function resize(page: Page, size: typeof WIDE): Promise<void> {
  await page.setViewportSize(size);
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(size.width);
  await settle(page);
}

test("wide to touch and back keeps the step, and each layout starts on its first screen", async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await ready(page, "/timeline/");
  const { step } = await whereOf(page);
  expect(await whereOf(page)).toMatchObject({ screen: 0, screens: 1 });

  await resize(page, PHONE);
  const phone = await whereOf(page);
  expect(phone).toMatchObject({ step, screen: 0 });
  expect(phone.screens).toBeGreaterThan(1);
  expect(await shown(page, "timeline")).toBe(true);
  expect(await shown(page, "skills")).toBe(false);

  // a screen part way through the step, then wide again
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await whereOf(page)).toMatchObject({ step, screen: 1 });
  await resize(page, WIDE);
  expect(await whereOf(page)).toMatchObject({ step, screen: 0, screens: 1 });
  for (const id of ["timeline", "education", "skills"])
    expect(await shown(page, id)).toBe(true);
  await expect(page).toHaveURL(/\/timeline\/$/);
});

test("a project's step survives the breakpoint both ways", async ({ page }) => {
  await page.setViewportSize(WIDE);
  await ready(page, "/work/unmacos/");
  const { step } = await whereOf(page);
  await resize(page, PHONE);
  expect(await whereOf(page)).toMatchObject({ step, screen: 0 });
  await resize(page, WIDE);
  expect(await whereOf(page)).toMatchObject({ step, screen: 0, screens: 1 });
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
});

test("a taller phone screen keeps the timeline entries on show, not the screen index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await ready(page, "/timeline/");
  await settle(page);
  // a timeline screen past the second, so fewer pages would put the same
  // index on Education or Skills
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowDown");
    await settle(page);
  }
  const before = await whereOf(page);
  expect(before.screen).toBe(3);
  expect(await shown(page, "timeline")).toBe(true);
  const [first] = await timelineEntries(page);
  expect(first).toBeDefined();

  await resize(page, { width: 390, height: 1000 });
  const after = await whereOf(page);
  expect(after.step).toBe(before.step);
  expect(after.screens).toBeLessThan(before.screens);
  expect(await shown(page, "timeline")).toBe(true);
  const tall = await timelineEntries(page);
  expect(tall).toContain(first);

  // and back: the first entry the taller screen showed is still on show
  await resize(page, { width: 390, height: 667 });
  expect(await shown(page, "timeline")).toBe(true);
  expect(await timelineEntries(page)).toContain(tall[0]);
});

test.describe("reduced motion on touch", () => {
  const { defaultBrowserType: _engine, ...pixel } = devices["Pixel 7"];
  test.use({ ...pixel, reducedMotion: "reduce" });

  test("a swipe still moves exactly one screen each way", async ({ page }) => {
    await ready(page, "/");
    await page.waitForLoadState("networkidle");
    await settle(page);
    await warmUpTouch(page);
    const s = SWIPES[0] as (typeof SWIPES)[number];
    for (let i = 0; i < 3; i++) {
      const { before, after } = await swipeScreen(page, 1, s);
      expect(isOneScreen(before, after, 1)).toBe(true);
      await settle(page);
    }
    for (let i = 0; i < 3; i++) {
      const { before, after } = await swipeScreen(page, -1, s);
      expect(isOneScreen(before, after, -1)).toBe(true);
      await settle(page);
    }
    expect(await whereOf(page)).toMatchObject({ step: 0, screen: 0 });
  });

  test("crossing to wide and back keeps the step", async ({ page }) => {
    await ready(page, "/timeline/");
    await settle(page);
    const { step } = await whereOf(page);
    await resize(page, WIDE);
    expect(await whereOf(page)).toMatchObject({ step, screen: 0, screens: 1 });
    await resize(page, PHONE);
    expect(await whereOf(page)).toMatchObject({ step, screen: 0 });
    await expect(area(page)).toHaveAttribute("data-retiling", "false");
  });
});
