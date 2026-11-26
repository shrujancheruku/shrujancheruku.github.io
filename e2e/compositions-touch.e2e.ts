import { devices, expect, type Page, test } from "@playwright/test";
import { toComposition } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// the session takes about 17 s and some tests play it twice
test.describe.configure({ timeout: 90_000 });

const slot = (page: Page) => page.locator('[data-composition="orca-flow"]');

test("on touch orca-flow shows the command, the header, the nine tickets without titles and the pull request line", async ({
  page,
}) => {
  await page.goto("/work/orca-flow/");
  await toComposition(page);
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 45_000,
  });
  const scene = slot(page).locator(".scene");
  await expect(
    scene.locator("b", { hasText: "/flow:build #42" }),
  ).toBeVisible();
  await expect(scene.locator(".clock")).toBeVisible();
  await expect(scene.locator(".clock")).toHaveText("38m 12s");
  await expect(scene.locator(".row")).toHaveCount(9);
  for (const row of await scene.locator(".row").all()) {
    await expect(row.locator(".ti")).toBeHidden();
    await expect(row.locator(".st")).toHaveText("merged ✓");
  }
  await expect(scene.locator(".pr")).toContainText("9/9 merged");
  await expect(scene.locator(".pr")).toContainText("✓ PR #53 ready to merge");
  // the coordinator's message and the question are dropped
  await expect(scene.getByText("Sized nine tickets")).toBeHidden();
  await expect(scene.getByText("Question from the coordinator")).toBeHidden();
  await expect(scene.getByText("Answered:")).toBeHidden();
});

test("the scene unit sets text at about 11px on touch", async ({ page }) => {
  await page.goto("/work/orca-flow/");
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const size = await slot(page)
    .locator(".scene")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(10.2);
  expect(size).toBeLessThan(11.6);
});

test("on touch every row fits its window with no sideways overflow", async ({
  page,
}) => {
  await page.goto("/work/orca-flow/");
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 45_000,
  });
  const over = await slot(page)
    .locator(".scene")
    .evaluate((scene) =>
      [...scene.querySelectorAll<HTMLElement>(".row, .pr div")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent),
    );
  expect(over).toEqual([]);
  // and every row and the pull request fit inside the window, none cut off
  const outside = await slot(page)
    .locator(".scene")
    .evaluate((scene) => {
      const box = scene.getBoundingClientRect();
      return [...scene.querySelectorAll<HTMLElement>(".row, .pr")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > box.bottom + 1 || r.top < box.top - 1;
        })
        .map((el) => el.className);
    });
  expect(outside).toEqual([]);
});
