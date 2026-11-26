import { devices, expect, type Page, test } from "@playwright/test";
import {
  area,
  pinch,
  pinchZoomWorks,
  ready,
  SWIPES,
  settle,
  swipe,
  twoFingerSpread,
  warmUpTouch,
} from "./helpers";

// Pinch-zoom on a phone stays the browser's: a pinch zooms the page and never
// moves a step, a drag on the zoomed page pans it and moves no step, and at
// scale 1 one swipe still moves exactly one step. Taps still click.
//
// Chromium on Linux (the CI runner) never zooms on a synthesized pinch, not
// even on a bare page (pinchZoomWorks), so there the zoom itself cannot be
// seen: the tests still check that the page leaves pinch-zoom to the browser
// and that a two-finger gesture moves no step, and skip only what needs the
// page to be zoomed in. Where the browser zooms (macOS) they check it all.

test.setTimeout(60_000);

const stepOf = async (page: Page) =>
  Number(await area(page).getAttribute("data-step"));
const zoom = (page: Page) =>
  page.evaluate(() => window.visualViewport?.scale ?? 1);

const PHONES = ["Pixel 7", "iPhone 14"] as const;
for (const phone of PHONES) {
  test.describe(phone, () => {
    // CDP touch needs Chromium: the phone's size, touch and agent, not WebKit
    const { defaultBrowserType: _engine, ...emulation } = devices[phone];
    test.use(emulation);

    test.beforeEach(async ({ page }) => {
      await ready(page, "/");
      await page.waitForLoadState("networkidle");
      await settle(page);
      await warmUpTouch(page);
    });

    const zoomable = async (page: Page) => {
      const works = await pinchZoomWorks(page);
      if (!works)
        test.info().annotations.push({
          type: "skip",
          description:
            "this browser does not pinch-zoom (synthesized pinch leaves scale 1): zoom assertions skipped",
        });
      return works;
    };

    test("a pinch zooms the page and moves no step", async ({ page }) => {
      expect(await zoom(page)).toBe(1);
      // the page leaves pinch-zoom to the browser
      for (const el of ["html", "body"])
        expect(
          await page
            .locator(el)
            .evaluate((e) => getComputedStyle(e).touchAction),
          `${el} touch-action`,
        ).toContain("pinch-zoom");
      // two fingers, as the page sees them, move no step
      await twoFingerSpread(page);
      await page.waitForTimeout(300);
      expect(await stepOf(page)).toBe(0);
      const scale = await pinch(page, 2);
      if (await zoomable(page)) expect(scale).toBeGreaterThan(1.5);
      await page.waitForTimeout(300);
      expect(await stepOf(page)).toBe(0);
    });

    test("on a zoomed-in page a drag moves no step; zoomed back out, one swipe is one step", async ({
      page,
    }) => {
      if (await zoomable(page)) {
        expect(await pinch(page, 2)).toBeGreaterThan(1.5);
        for (const s of SWIPES) {
          await swipe(page, 1, s);
          await page.waitForTimeout(300);
          expect(await stepOf(page), `${s.name} drag while zoomed`).toBe(0);
        }
      } else {
        await pinch(page, 2);
      }
      // one synthesized pinch spans only so far: pinch out till it is back to 1
      for (let i = 0; i < 6 && (await zoom(page)) > 1.01; i++)
        await pinch(page, 0.5);
      expect(await zoom(page)).toBeLessThanOrEqual(1.01);
      await page.waitForTimeout(300);
      expect(await stepOf(page)).toBe(0);
      for (const s of SWIPES) {
        const before = await stepOf(page);
        await swipe(page, 1, s);
        await expect(area(page)).toHaveAttribute(
          "data-step",
          String(before + 1),
        );
        await page.waitForTimeout(200);
        expect(await stepOf(page), `${s.name} swipe at scale 1`).toBe(
          before + 1,
        );
        await settle(page);
      }
    });

    test("taps on links and buttons still work", async ({ page }) => {
      // a link: the opening's teaser goes to the now step and its address
      await page.locator("a.teaser").tap();
      await expect(page).toHaveURL(/\/now\/$/);
      await expect(area(page)).not.toHaveAttribute("data-step", "0");
      await settle(page);
      // a button: the status bar's home goes back to the opening
      await page.locator('[data-act="home"]').tap();
      await expect(area(page)).toHaveAttribute("data-step", "0");
      await settle(page);
      // a button: the status bar's contact
      await page.locator('[data-act="contact"]').tap();
      await expect(page).toHaveURL(/\/contact\/$/);
      await settle(page);
      // a button: a workspace number
      await page.locator(".ws button").nth(2).tap();
      await expect(area(page)).toHaveAttribute("data-workspace", "2");
    });
  });
}
