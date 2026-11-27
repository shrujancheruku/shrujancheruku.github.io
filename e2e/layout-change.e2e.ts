import { expect, type Page, test } from "@playwright/test";
import {
  expectNotRetiling,
  isOneScreen,
  isShown,
  PHONES,
  ready,
  settle,
  whereOf,
} from "./desktop";
import { SWIPES, swipeScreen, warmUpTouch } from "./helpers";

// The window crossing the touch breakpoint (760px) and back, and a phone
// screen changing size: the onLayoutChange and remeasure paths of
// src/scripts/desktop.ts.

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

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
  expect(await isShown(page, "timeline")).toBe(true);
  expect(await isShown(page, "skills")).toBe(false);

  // a screen part way through the step, then wide again
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await whereOf(page)).toMatchObject({ step, screen: 1 });
  await resize(page, WIDE);
  expect(await whereOf(page)).toMatchObject({ step, screen: 0, screens: 1 });
  for (const id of ["timeline", "education", "skills"])
    expect(await isShown(page, id)).toBe(true);
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

test("a taller phone screen keeps the timeline step's two screens, and the one you are on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await ready(page, "/timeline/");
  await settle(page);
  expect(await whereOf(page)).toMatchObject({ screen: 0, screens: 2 });
  expect(await isShown(page, "timeline")).toBe(true);
  expect(await isShown(page, "education")).toBe(false);

  await resize(page, { width: 390, height: 1000 });
  expect(await whereOf(page)).toMatchObject({ screen: 0, screens: 2 });
  expect(await isShown(page, "timeline")).toBe(true);

  // on the second screen, education over skills, a resize stays there
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await whereOf(page)).toMatchObject({ screen: 1, screens: 2 });
  await resize(page, { width: 390, height: 667 });
  expect(await whereOf(page)).toMatchObject({ screen: 1, screens: 2 });
  expect(await isShown(page, "education")).toBe(true);
  expect(await isShown(page, "skills")).toBe(true);
  expect(await isShown(page, "timeline")).toBe(false);
});

test.describe("reduced motion on touch", () => {
  test.use({ ...PHONES["Pixel 7"], reducedMotion: "reduce" });

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
    await expectNotRetiling(page);
  });
});
