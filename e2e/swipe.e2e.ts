import { devices, expect, type Page, test } from "@playwright/test";
import { area, ready, SWIPES, settle, swipe, warmUpTouch } from "./helpers";

// One swipe on a phone moves exactly one step. Swipes are real touch events
// (CDP), so the browser's own scrolling gets its chance to take them.

test.setTimeout(120_000);

const stepOf = async (page: Page) =>
  Number(await area(page).getAttribute("data-step"));

const PHONES = ["Pixel 7", "iPhone 14"] as const;
for (const phone of PHONES) {
  test.describe(phone, () => {
    // CDP touch needs Chromium: the phone's size, touch and agent, not WebKit
    const { defaultBrowserType: _engine, ...emulation } = devices[phone];
    test.use(emulation);

    for (const s of SWIPES) {
      test(`a ${s.name} swipe moves exactly one step, from every step, both ways`, async ({
        page,
      }) => {
        await ready(page, "/");
        await page.waitForLoadState("networkidle");
        await settle(page);
        await warmUpTouch(page);
        const total = await page.evaluate(() =>
          JSON.parse(
            document.getElementById("desktop-model")?.textContent ?? "[]",
          ).reduce(
            (n: number, w: { steps: unknown[] }) => n + w.steps.length,
            0,
          ),
        );
        for (let n = 0; n < total - 1; n++) {
          await swipe(page, 1, s);
          await expect(area(page)).toHaveAttribute("data-step", String(n + 1));
          await page.waitForTimeout(150);
          expect(await stepOf(page)).toBe(n + 1);
        }
        for (let n = total - 1; n > 0; n--) {
          await swipe(page, -1, s);
          await expect(area(page)).toHaveAttribute("data-step", String(n - 1));
          await page.waitForTimeout(150);
          expect(await stepOf(page)).toBe(n - 1);
        }
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
      const total = await page.evaluate(() =>
        JSON.parse(
          document.getElementById("desktop-model")?.textContent ?? "[]",
        ).reduce((n: number, w: { steps: unknown[] }) => n + w.steps.length, 0),
      );
      await page.setViewportSize({
        width: size.width,
        height: size.height + 90,
      });
      for (let n = 0; n < total - 1; n++) {
        await swipe(
          page,
          1,
          SWIPES[1] ?? { name: "long", distance: 380, ms: 400 },
        );
        await expect(area(page)).toHaveAttribute("data-step", String(n + 1));
      }
      await page.setViewportSize(size);
      await expect(area(page)).toHaveAttribute("data-step", String(total - 1));
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
