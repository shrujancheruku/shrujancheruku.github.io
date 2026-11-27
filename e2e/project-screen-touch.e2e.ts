import { expect, test } from "@playwright/test";
import { allPhones, ready, settle, shown, whereOf } from "./desktop";
import { typed, unseen } from "./fit";
import { SWIPES, swipe, warmUpTouch } from "./helpers";

// On a phone a featured project is one screen: the counter, the name, the
// pitch, the proof lines, the facts, the links and the composition, with the
// stack dropped. One swipe moves from one project to the next, and the archive
// is still one tap away.

test.setTimeout(240_000);

for (const [name, phone] of allPhones()) {
  test.describe(name, () => {
    test.use(phone);

    test("each featured project is one screen with its copy, proof lines and composition, and one swipe reaches the next", async ({
      page,
    }) => {
      await ready(page, "/work/");
      await warmUpTouch(page);
      const first = await whereOf(page);
      const featured = await page.locator('[data-window^="copy-"]').count();
      expect(featured).toBeGreaterThan(1);
      for (let n = 1; n <= featured; n++) {
        const at = await whereOf(page);
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
            .poll(async () => (await whereOf(page)).step)
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
