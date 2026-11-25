import { devices, expect, type Page, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

const slot = (page: Page) => page.locator('[data-composition="unmacos"]');

test("on touch it is the same desktop, with the windows clipping their text", async ({
  page,
}) => {
  await page.goto("/work/unmacos/");
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".tile")).toHaveCount(3);
  await expect(scene.locator(".sb")).toContainText("· 23 themes");
  const clipped = await scene
    .locator(".tile")
    .evaluateAll((els) =>
      els.some(
        (el) =>
          el.scrollWidth > el.clientWidth + 1 ||
          el.scrollHeight > el.clientHeight + 1,
      ),
    );
  expect(clipped).toBe(true);
  // nothing spills out of the scene
  const spill = await scene.evaluate((s) => {
    const box = s.getBoundingClientRect();
    return [...s.querySelectorAll<HTMLElement>(".tile")].some((t) => {
      const r = t.getBoundingClientRect();
      return r.right > box.right + 1 || r.bottom > box.bottom + 1;
    });
  });
  expect(spill).toBe(false);
});

test("on touch the scene unit sets text at about 11px", async ({ page }) => {
  await page.goto("/work/unmacos/");
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const size = await slot(page)
    .locator(".scene")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(10.2);
  expect(size).toBeLessThan(11.6);
});
