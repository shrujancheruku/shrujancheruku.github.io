import { devices, expect, type Page, test } from "@playwright/test";
import { toComposition } from "./helpers";

test.use({ ...devices["Pixel 7"] });

const slot = (page: Page) => page.locator('[data-composition="unmacos"]');

test("on touch it is the same desktop, with the windows clipping their text (#83)", async ({
  page,
}) => {
  await page.goto("/work/unmacos/");
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".tile")).toHaveCount(3);
  await expect(scene.locator(".sb")).toContainText("· 23 themes");
  // the desktop is not reflowed: nvim's code runs off its pane's edge, and a
  // label too long for its panel ends in an ellipsis
  const clipped = await scene.evaluate((s) => {
    const runsOff = [
      ...s.querySelectorAll<HTMLElement>("[data-runs-off]"),
    ].some((el) => el.scrollWidth > el.clientWidth + 1);
    const shortened = [...s.querySelectorAll<HTMLElement>(".tile *")].some(
      (el) =>
        getComputedStyle(el).textOverflow === "ellipsis" &&
        el.scrollWidth > el.clientWidth + 1,
    );
    return { runsOff, shortened };
  });
  expect(clipped).toEqual({ runsOff: true, shortened: true });
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
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const size = await slot(page)
    .locator(".scene")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(10.2);
  expect(size).toBeLessThan(11.6);
});
