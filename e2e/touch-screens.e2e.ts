import { devices, expect, type Page, test } from "@playwright/test";
import { typed, unseen } from "./fit";
import { area, ready, SWIPES, settle, swipe, warmUpTouch } from "./helpers";

// On a phone nothing scrolls, so every window must fit its box. A step is
// split into screens (src/lib/screens.ts); this walks every screen by swipe on
// three phone sizes and checks that no window's content is cut off, that the
// timeline, the archive and Education & Internships are reachable whole and in
// order, and that the address stays the step's.

// a walk over every screen both ways takes 3 to 4 minutes on the CI runner
test.setTimeout(420_000);

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

/** The step, the screen in it, and how many screens the step has. */
const where = (page: Page) =>
  area(page).evaluate((a) => ({
    step: Number(a.dataset.step),
    screen: Number(a.dataset.screen),
    screens: Number(a.dataset.screens),
  }));

const lastStep = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(
          document.getElementById("desktop-addresses")?.textContent ?? "{}",
        ).byStep as string[]
      ).length - 1,
  );

/** One swipe down or up; waits for the screen it moves to. */
async function move(page: Page, direction: 1 | -1): Promise<void> {
  const before = await where(page);
  await swipe(page, direction, SWIPES[0] as (typeof SWIPES)[number]);
  await expect
    .poll(async () => {
      const now = await where(page);
      return now.step !== before.step || now.screen !== before.screen;
    })
    .toBe(true);
  await settle(page);
}

for (const [name, emulation] of Object.entries(PHONES)) {
  test.describe(name, () => {
    const { defaultBrowserType: _engine, ...phone } = emulation as {
      defaultBrowserType?: string;
    };
    test.use(phone);

    test("every screen of every step fits its windows, and the address is the step's", async ({
      page,
    }) => {
      await ready(page, "/");
      await warmUpTouch(page);
      const last = await lastStep(page);
      const addresses = await page.evaluate(
        () =>
          JSON.parse(
            document.getElementById("desktop-addresses")?.textContent ?? "{}",
          ).byStep as string[],
      );
      const visited: string[] = [];
      for (let guard = 0; guard < 80; guard++) {
        const at = await where(page);
        visited.push(`${at.step}.${at.screen}`);
        await typed(page);
        // soft: one walk reports every screen with something cut off
        expect
          .soft(await unseen(page), `step ${at.step} screen ${at.screen}`)
          .toEqual([]);
        expect(new URL(page.url()).pathname).toBe(addresses[at.step]);
        if (at.step === last && at.screen === at.screens - 1) break;
        await move(page, 1);
      }
      // every step was visited, and the timeline, the sabbatical and the contact have several screens
      const steps = new Set(visited.map((v) => v.split(".")[0]));
      expect(steps.size).toBe(last + 1);
      expect(visited.length).toBeGreaterThan(last + 1 + 4);
      // and the way back retraces it
      const back: string[] = [];
      for (let guard = 0; guard < 80; guard++) {
        const at = await where(page);
        back.push(`${at.step}.${at.screen}`);
        if (at.step === 0 && at.screen === 0) break;
        await move(page, -1);
      }
      expect(back.reverse()).toEqual(visited);
    });

    test("the timeline's entries and the resume download are all reachable, in order, newest first", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      // directly opened: the first timeline screen, and the address stays
      const first = await where(page);
      expect(first.screen).toBe(0);
      const titles: string[] = [];
      let download = -1;
      for (let guard = 0; guard < 20; guard++) {
        const at = await where(page);
        if (at.screen > 0 && titles.length === 0) break;
        const shown = await page.evaluate(() => {
          const pane = document.querySelector('[data-window="timeline"]');
          if (!pane || getComputedStyle(pane).display === "none") return null;
          return {
            dl:
              !!pane.querySelector(".dl:not([hidden])") &&
              ![...pane.querySelectorAll(".dl")].every((d) =>
                d.closest("[hidden]"),
              ),
            titles: [...pane.querySelectorAll(".te")]
              .filter((e) => !e.hasAttribute("hidden"))
              .map(
                (e) =>
                  e.querySelector(".org")?.textContent ??
                  e.querySelector(".title")?.textContent ??
                  "",
              ),
          };
        });
        if (!shown) break;
        if (shown.dl && download < 0) download = at.screen;
        titles.push(...shown.titles);
        expect(new URL(page.url()).pathname).toBe("/timeline/");
        await move(page, 1);
      }
      expect(download).toBe(0);
      expect(titles).toEqual([
        "Sabbatical",
        "OpenBench",
        "Unsupervised",
        "Ibotta",
        "Orderly Health",
      ]);
    });

    test("education opens to its roles, every one reachable and fitting, and closing returns to its screen", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      while (await page.locator('[data-window="education"]').isHidden())
        await move(page, 1);
      const before = await where(page);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      const total = await page.locator("#education-roles > article").count();
      expect(total).toBeGreaterThan(0);
      const seen: string[] = [];
      for (let guard = 0; guard < 20; guard++) {
        expect(await unseen(page)).toEqual([]);
        seen.push(
          ...(await page
            .locator("#education-roles > article:not([hidden])")
            .evaluateAll((els) => els.map((e) => e.textContent ?? ""))),
        );
        const at = await where(page);
        if (at.screen === at.screens - 1) break;
        await move(page, 1);
      }
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(seen.length);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect((await where(page)).screen).toBe(before.screen);
      expect(await unseen(page)).toEqual([]);
    });

    test("the archive lists every entry across its screens, each fitting", async ({
      page,
    }) => {
      await ready(page, "/archive/");
      await warmUpTouch(page);
      const total = await page.locator("[data-archive] [data-entry]").count();
      expect(total).toBeGreaterThan(0);
      const seen: string[] = [];
      for (let guard = 0; guard < 20; guard++) {
        expect(await unseen(page)).toEqual([]);
        seen.push(
          ...(await page
            .locator("[data-archive] [data-entry]:not([hidden])")
            .evaluateAll((els) =>
              els.map((e) => (e as HTMLElement).dataset.entry ?? ""),
            )),
        );
        const at = await where(page);
        if (at.screen === at.screens - 1) break;
        await move(page, 1);
        expect(new URL(page.url()).pathname).toBe("/archive/");
      }
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
    });
  });
}
