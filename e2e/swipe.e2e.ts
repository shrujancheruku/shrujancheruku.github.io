import { devices, expect, test } from "@playwright/test";
import {
  atEnd,
  isOneScreen,
  ready,
  SWIPES,
  settle,
  swipeScreen,
  warmUpTouch,
  whereOf,
} from "./helpers";

// One swipe on a phone moves exactly one screen (a step is one or more). Swipes are real touch events
// (CDP), so the browser's own scrolling gets its chance to take them.

test.setTimeout(120_000);

const PHONES = ["Pixel 7", "iPhone 14"] as const;
for (const phone of PHONES) {
  test.describe(phone, () => {
    // CDP touch needs Chromium: the phone's size, touch and agent, not WebKit
    const { defaultBrowserType: _engine, ...emulation } = devices[phone];
    test.use(emulation);

    for (const s of SWIPES) {
      test(`a ${s.name} swipe moves exactly one screen, from every screen, both ways`, async ({
        page,
      }) => {
        await ready(page, "/");
        await page.waitForLoadState("networkidle");
        await settle(page);
        await warmUpTouch(page);
        let screens = 0;
        for (let guard = 0; guard < 80; guard++) {
          const { before, after } = await swipeScreen(page, 1, s);
          expect(
            isOneScreen(before, after, 1),
            `${JSON.stringify([before, after])}`,
          ).toBe(true);
          screens++;
          await settle(page);
          if (await atEnd(page, after)) break;
        }
        // the end is the contact step; every screen was reached on the way
        expect(screens).toBeGreaterThan(7);
        for (let n = 0; n < screens; n++) {
          const { before, after } = await swipeScreen(page, -1, s);
          expect(
            isOneScreen(before, after, -1),
            `${JSON.stringify([before, after])}`,
          ).toBe(true);
          await settle(page);
        }
        expect(await whereOf(page)).toMatchObject({ step: 0, screen: 0 });
      });
    }

    test("the URL bar hiding (viewport height change) does not lose a step", async ({
      page,
    }) => {
      await ready(page, "/");
      await page.waitForLoadState("networkidle");
      await settle(page);
      await warmUpTouch(page);
      const size = page.viewportSize();
      if (!size) throw new Error("no viewport");
      await page.setViewportSize({
        width: size.width,
        height: size.height + 90,
      });
      const long = SWIPES[1] ?? { name: "long", distance: 380, ms: 400 };
      for (let guard = 0; guard < 80; guard++) {
        const { before, after } = await swipeScreen(page, 1, long);
        expect(isOneScreen(before, after, 1)).toBe(true);
        if (await atEnd(page, after)) break;
      }
      await page.setViewportSize(size);
      await expect
        .poll(async () => atEnd(page, await whereOf(page)))
        .toBe(true);
    });

    test("no window scrolls its own content on touch", async ({ page }) => {
      await ready(page, "/");
      const scrollers = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".pane *")]
          .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY))
          .map((e) => e.className.toString() || e.tagName),
      );
      expect(scrollers).toEqual([]);
    });

    for (const path of [
      "/",
      "/work/",
      "/timeline/",
      "/now/",
      "/contact/",
      "/archive/",
    ]) {
      test(`${path} opens on its step with the status bar intact`, async ({
        page,
      }) => {
        await ready(page, path);
        await page.waitForTimeout(400);
        const bar = await page.locator("header.bar").boundingBox();
        const vis = await page.evaluate(() => ({
          y: scrollY,
          h: innerHeight,
          step: document.querySelector("main.area")?.getAttribute("data-step"),
        }));
        expect(bar?.y ?? -1).toBeGreaterThanOrEqual(0);
        expect(bar?.height).toBe(40);
        expect(new URL(page.url()).pathname).toBe(path);
        expect(vis.step).not.toBeNull();
      });
    }
  });
}
