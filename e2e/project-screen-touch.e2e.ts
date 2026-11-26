import { devices, expect, type Page, test } from "@playwright/test";
import { typed, unseen } from "./fit";
import { area, ready, SWIPES, settle, swipe, warmUpTouch } from "./helpers";

// On a phone a featured project is one screen: the counter, the name, the
// pitch, the proof lines, the facts, the links and the composition, with the
// stack dropped. One swipe moves from one project to the next, and the archive
// is still one tap away.

test.setTimeout(240_000);

const PHONES = {
  "Pixel 7": devices["Pixel 7"],
  "iPhone 14": devices["iPhone 14"],
  "375x667": {
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
} as const;

const where = (page: Page) =>
  area(page).evaluate((a) => ({
    step: Number(a.dataset.step),
    screens: Number(a.dataset.screens),
  }));

/** The windows on show, by id. */
const shown = (page: Page) =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window ?? ""),
  );

for (const [name, emulation] of Object.entries(PHONES)) {
  test.describe(name, () => {
    const { defaultBrowserType: _engine, ...phone } = emulation as {
      defaultBrowserType?: string;
    };
    test.use(phone);

    test("each featured project is one screen with its copy, proof lines and composition, and one swipe reaches the next", async ({
      page,
    }) => {
      await ready(page, "/work/");
      await warmUpTouch(page);
      const first = await where(page);
      const featured = await page.locator('[data-window^="copy-"]').count();
      expect(featured).toBeGreaterThan(1);
      for (let n = 1; n <= featured; n++) {
        const at = await where(page);
        expect(at.step, `project ${n}`).toBe(first.step + n - 1);
        expect(at.screens, `project ${n} screens`).toBe(1);
        expect(await shown(page), `project ${n} windows`).toEqual(
          expect.arrayContaining([`copy-${n}`, `comp-${n}`]),
        );
        expect(await shown(page)).not.toContain("stack");
        const copy = page.locator(`[data-window="copy-${n}"]`);
        for (const part of [".kick", "h2", ".pitch", ".facts", ".links"])
          await expect(copy.locator(part), `${part} of ${n}`).toBeVisible();
        const proof = copy.locator(".proof li");
        expect(await proof.count()).toBeGreaterThanOrEqual(2);
        for (const li of await proof.all()) await expect(li).toBeVisible();
        await expect(
          copy.locator(".open"),
          `archive entry of ${n}`,
        ).toBeVisible();
        await typed(page);
        expect(await unseen(page), `project ${n}`).toEqual([]);
        if (n < featured) {
          await swipe(page, 1, SWIPES[0] as (typeof SWIPES)[number]);
          await expect
            .poll(async () => (await where(page)).step)
            .toBe(first.step + n);
          await settle(page);
        }
      }
    });

    test("the archive opens from a project's screen", async ({ page }) => {
      await ready(page, "/work/");
      await warmUpTouch(page);
      await page.locator('[data-window="copy-1"] .open').tap();
      await expect(page).toHaveURL(/\/archive\/$/);
      await settle(page);
      expect(await shown(page)).toEqual(["archive"]);
    });
  });
}
