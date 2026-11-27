import { expect, test } from "@playwright/test";
import {
  addressesOf,
  allPhones,
  atEnd,
  atStart,
  lastStep,
  ready,
  settle,
  whereOf,
} from "./desktop";
import { typed, unseen } from "./fit";
import { swipeScreen, warmUpTouch } from "./helpers";

// On a phone nothing scrolls, so every window must fit its box. A step is
// split into screens (src/lib/screens.ts); this walks every screen by swipe on
// three phone sizes and checks that no window's content is cut off, that the
// timeline, the archive and Education & Internships are reachable whole and in
// order, and that the address stays the step's.

// a walk over every screen both ways takes 3 to 4 minutes on the CI runner
test.setTimeout(420_000);

for (const [name, phone] of allPhones()) {
  test.describe(name, () => {
    test.use(phone);

    test("every screen of every step fits its windows, and the address is the step's", async ({
      page,
    }) => {
      await ready(page, "/");
      await warmUpTouch(page);
      const last = await lastStep(page);
      const addresses = await addressesOf(page);
      const visited: string[] = [];
      for (let guard = 0; guard < 80; guard++) {
        const at = await whereOf(page);
        visited.push(`${at.step}.${at.screen}`);
        await typed(page);
        // soft: one walk reports every screen with something cut off
        expect
          .soft(await unseen(page), `step ${at.step} screen ${at.screen}`)
          .toEqual([]);
        expect(new URL(page.url()).pathname).toBe(addresses[at.step]);
        if (await atEnd(page, at)) break;
        await swipeScreen(page, 1);
      }
      // every step was visited, and each screen once
      const steps = new Set(visited.map((v) => v.split(".")[0]));
      expect(steps.size).toBe(last + 1);
      expect(new Set(visited).size).toBe(visited.length);
      // and the way back retraces it
      const back: string[] = [];
      for (let guard = 0; guard < 80; guard++) {
        const at = await whereOf(page);
        back.push(`${at.step}.${at.screen}`);
        if (atStart(at)) break;
        await swipeScreen(page, -1);
      }
      expect(back.reverse()).toEqual(visited);
    });

    test("the timeline's entries and the resume download are all reachable, in order, newest first", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      // directly opened: the first timeline screen, and the address stays
      const first = await whereOf(page);
      expect(first.screen).toBe(0);
      const titles: string[] = [];
      let download = -1;
      for (let guard = 0; guard < 20; guard++) {
        const at = await whereOf(page);
        if (at.screen > 0 && titles.length === 0) break;
        const onScreen = await page.evaluate(() => {
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
        if (!onScreen) break;
        if (onScreen.dl && download < 0) download = at.screen;
        titles.push(...onScreen.titles);
        expect(new URL(page.url()).pathname).toBe("/timeline/");
        await swipeScreen(page, 1);
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
        await swipeScreen(page, 1);
      const before = await whereOf(page);
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
        const at = await whereOf(page);
        if (at.screen === at.screens - 1) break;
        await swipeScreen(page, 1);
      }
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(seen.length);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect((await whereOf(page)).screen).toBe(before.screen);
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
        const at = await whereOf(page);
        if (at.screen === at.screens - 1) break;
        await swipeScreen(page, 1);
        expect(new URL(page.url()).pathname).toBe("/archive/");
      }
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
    });
  });
}
