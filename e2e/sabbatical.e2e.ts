import { expect, type Page, test } from "@playwright/test";
import { area, settle } from "./helpers";

const shown = (page: Page) =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window)
      .sort(),
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  // key 4: the sabbatical workspace (step 6 of 8 on the way to touch scrolling)
  await page.keyboard.press("4");
  await page.waitForTimeout(1100);
});

test("the sabbatical workspace shows the copy and four photo windows", async ({
  page,
}) => {
  expect(await shown(page)).toEqual([
    "photo-1",
    "photo-2",
    "photo-3",
    "photo-4",
    "sabbatical",
  ]);
});

test("the copy window reads the dates, the heading, the three lines and the foot", async ({
  page,
}) => {
  const copy = page.locator('.pane[data-window="sabbatical"]');
  await expect(copy).toContainText("Nov 2025 → Now");
  await expect(copy.locator("h2")).toHaveText("sabbatical");
  await expect(copy.locator("li")).toHaveText([
    "travelling the world",
    "time with family",
    "helping friends launch their products",
  ]);
  await expect(copy.locator(".foot")).toHaveText(
    "10/10 would recommend to a friend.",
  );
});

test("each photo window fills its tile and carries a place · date caption", async ({
  page,
}) => {
  for (const n of [1, 2, 3, 4]) {
    const pane = page.locator(`.pane[data-window="photo-${n}"]`);
    const body = await pane.locator(".body").boundingBox();
    const ph = await pane.locator(".ph").boundingBox();
    expect(
      body &&
        ph &&
        Math.abs(body.width - ph.width) < 1 &&
        Math.abs(body.height - ph.height) < 1,
    ).toBe(true);
    await expect(pane.locator(".cap")).toHaveText("somewhere · 2026");
    await expect(pane.locator(".ph")).toContainText(`photo ${n} · placeholder`);
  }
});

test("on touch the copy window is one screen and the 2 × 2 grid the next", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  await page.locator(".ws button").nth(3).click();
  await expect(area(page)).toHaveAttribute("data-workspace", "3");
  await settle(page);
  await expect(page.locator('.pane[data-window="sabbatical"]')).toBeVisible();
  await expect(page.locator('.pane[data-window="photo-1"]')).toBeHidden();
  await page.keyboard.press("ArrowDown");
  await expect(area(page)).toHaveAttribute("data-screen", "1");
  await settle(page);
  await expect(page.locator('.pane[data-window="sabbatical"]')).toBeHidden();
  const p1 = await page.locator('.pane[data-window="photo-1"]').boundingBox();
  const p2 = await page.locator('.pane[data-window="photo-2"]').boundingBox();
  const p3 = await page.locator('.pane[data-window="photo-3"]').boundingBox();
  expect(p1 && p2 && p2.x > p1.x).toBe(true);
  expect(p3 && p1 && p3.y > p1.y).toBe(true);
  await page.close();
});
