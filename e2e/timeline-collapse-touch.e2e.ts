import { devices, expect, type Page, test } from "@playwright/test";
import { unseen } from "./fit";
import { area, ready, settle, warmUpTouch, whereOf } from "./helpers";

// On a phone the timeline step is two screens: the timeline alone, its entries
// collapsed to their headings (a tap opens one), then education over skills.

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

    test("the timeline step is exactly two screens, neither paged: the timeline, then education over skills", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const screens = () =>
        area(page).evaluate((a) => Number(a.dataset.screens));
      expect(await screens()).toBe(2);
      expect((await whereOf(page)).screen).toBe(0);
      expect(await shown(page, "timeline")).toBe(true);
      expect(await shown(page, "education")).toBe(false);
      expect(await shown(page, "skills")).toBe(false);
      await expect(
        page.locator('[data-window="timeline"] article:not([hidden])'),
      ).toHaveCount(5);
      expect(await unseen(page)).toEqual([]);

      await page.keyboard.press("ArrowDown");
      await settle(page);
      expect((await whereOf(page)).screen).toBe(1);
      expect(await shown(page, "timeline")).toBe(false);
      expect(await shown(page, "education")).toBe(true);
      expect(await shown(page, "skills")).toBe(true);
      expect(await unseen(page)).toEqual([]);
      // no window pages: one more step moves on, never to a third screen
      expect(await screens()).toBe(2);
      // every skill, language and hobby is still there
      await expect(page.locator('[data-window="skills"] .fill')).toHaveCount(5);
      await expect(
        page.locator('[data-window="skills"] .langs li'),
      ).toHaveCount(5);
      await expect(
        page.locator('[data-window="skills"] [data-hobby]'),
      ).toHaveCount(9);
    });

    test("the skills window fits with 8px to spare, while the joke bar shoots in and once it rests", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      // widths depend on the web fonts: read them once all have loaded
      await page.evaluate(() => document.fonts.ready);
      // sample every frame of the bars' entry (the joke bar overshoots its
      // track) with the window 8px narrower than it is, from before the step
      // until the bars rest: nothing may overflow. Nothing clips the bars, so
      // an overshoot that leaves the column widens the window and shows here.
      const sampled = page.evaluate(
        () =>
          new Promise<{ over: number; frames: number; peak: number }>(
            (done) => {
              const sk = document.querySelector<HTMLElement>(".sk");
              const pane = sk?.closest<HTMLElement>(".pane");
              const joke = sk?.querySelector<HTMLElement>(".fill.joke");
              if (!sk || !pane || !joke)
                return done({
                  over: Number.POSITIVE_INFINITY,
                  frames: 0,
                  peak: 0,
                });
              const SLACK = 8;
              let worst = 0;
              let frames = 0;
              let peak = 0;
              let started = false;
              const t0 = performance.now();
              const tick = () => {
                if (getComputedStyle(pane).display !== "none") {
                  if (!sk.style.width)
                    sk.style.width = `${sk.clientWidth - SLACK}px`;
                  worst = Math.max(worst, sk.scrollWidth - sk.clientWidth);
                  frames++;
                  peak = Math.max(
                    peak,
                    new DOMMatrix(getComputedStyle(joke).transform).a,
                  );
                  started ||= pane.dataset.bars === "growing";
                }
                const done_ = started && pane.dataset.bars === "rest";
                if (!done_ && performance.now() - t0 < 10_000)
                  requestAnimationFrame(tick);
                else {
                  sk.style.width = "";
                  done({ over: worst, frames, peak });
                }
              };
              tick();
            },
          ),
      );
      await page.keyboard.press("ArrowDown");
      const { over, frames, peak } = await sampled;
      // the sampling saw the joke bar overshoot, not just its rest
      expect(frames).toBeGreaterThan(10);
      expect(peak).toBeGreaterThan(1.05);
      expect(over).toBeLessThanOrEqual(1);
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

      // education is on the second screen; opening it takes the workspace
      await page.keyboard.press("ArrowDown");
      await settle(page);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "timeline")).toBe(false);
      expect(await shown(page, "skills")).toBe(false);
      expect(await shown(page, "education")).toBe(true);
      expect(await unseen(page)).toEqual([]);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "education")).toBe(true);
      expect(await shown(page, "skills")).toBe(true);
      expect((await whereOf(page)).screen).toBe(1);
    });
  });
}
