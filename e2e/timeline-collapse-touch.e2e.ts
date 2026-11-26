import { devices, expect, type Page, test } from "@playwright/test";
import { unseen } from "./fit";
import { ready, settle, warmUpTouch, whereOf } from "./helpers";

// On a phone the timeline and Education & Internships share one screen, and
// the timeline's entries collapse to their headings: a tap opens one.

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

const shown = (page: Page, id: string) =>
  page
    .locator(`[data-window="${id}"]`)
    .evaluate((e) => getComputedStyle(e).display !== "none");

const toggles = (page: Page) =>
  page.locator('[data-window="timeline"] button[aria-expanded]');

const expanded = (page: Page) =>
  toggles(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-expanded")),
  );

for (const [name, emulation] of Object.entries(PHONES)) {
  test.describe(name, () => {
    const { defaultBrowserType: _engine, ...phone } = emulation as {
      defaultBrowserType?: string;
    };
    test.use(phone);

    test("the timeline step is two screens: timeline with education, then skills", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      // the timeline and education are one screen; skills (which pages itself
      // where it overflows, as before) follows
      expect((await whereOf(page)).screen).toBe(0);
      expect(await shown(page, "timeline")).toBe(true);
      expect(await shown(page, "education")).toBe(true);
      expect(await shown(page, "skills")).toBe(false);
      await expect(
        page.locator('[data-window="timeline"] article'),
      ).toHaveCount(5);
      await expect(
        page.locator('[data-window="timeline"] article:not([hidden])'),
      ).toHaveCount(5);
      expect(await unseen(page)).toEqual([]);
      await page.keyboard.press("ArrowDown");
      await settle(page);
      expect(await shown(page, "skills")).toBe(true);
      expect(await shown(page, "timeline")).toBe(false);
    });

    test("entries open by tap and by keyboard, one at a time, and everything still fits", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const buttons = toggles(page);
      await expect(buttons).toHaveCount(5);
      expect(await expanded(page)).toEqual(Array(5).fill("false"));
      const before = await whereOf(page);

      // every entry in turn, the longest included
      for (let i = 0; i < 5; i++) {
        await buttons.nth(i).tap();
        await settle(page);
        expect((await expanded(page))[i]).toBe("true");
        expect((await expanded(page)).filter((v) => v === "true")).toHaveLength(
          1,
        );
        expect(await unseen(page), `entry ${i} open`).toEqual([]);
        expect(await whereOf(page)).toEqual(before);
      }

      // tapping the open one closes it
      await buttons.nth(4).tap();
      await settle(page);
      expect(await expanded(page)).toEqual(Array(5).fill("false"));

      // keyboard: Enter opens, Space closes
      await buttons.nth(1).focus();
      await page.keyboard.press("Enter");
      await settle(page);
      expect((await expanded(page))[1]).toBe("true");
      await page.keyboard.press("Space");
      await settle(page);
      expect((await expanded(page))[1]).toBe("false");
      expect(await whereOf(page)).toEqual(before);
    });

    test("the resume download stays at the top, and Education & Internships still opens whole", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const dl = page.locator('[data-window="timeline"] a[download]');
      const first = await page
        .locator('[data-window="timeline"] article')
        .first()
        .boundingBox();
      const box = await dl.boundingBox();
      expect(box && first && box.y < first.y).toBe(true);

      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "timeline")).toBe(false);
      expect(await shown(page, "education")).toBe(true);
      expect(await unseen(page)).toEqual([]);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "timeline")).toBe(true);
      expect((await whereOf(page)).screen).toBe(0);
    });
  });
}
