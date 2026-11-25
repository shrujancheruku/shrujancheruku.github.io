import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

test("at touch width the windows stack in one column and the bar shows numbers at 40px", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const bar = await page.locator("header.bar").boundingBox();
  expect(bar?.height).toBe(40);
  // numbers only: the names are not shown
  const names = page.locator(".ws .name");
  await expect(names).toHaveCount(5);
  for (const name of await names.all()) await expect(name).toBeHidden();

  const boxes = await page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, width: r.width, top: r.top };
      }),
  );
  expect(boxes).toHaveLength(3);
  // one column: every window has the same left edge and width
  expect(new Set(boxes.map((b) => Math.round(b.left))).size).toBe(1);
  expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
});

test("a swipe moves one step, by native scroll-snap", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  const snap = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollSnapType,
  );
  expect(snap).toContain("y");
  // scrolling the document by one screen lands on the next step
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight, behavior: "instant" }),
  );
  await expect(page.locator("main.area")).toHaveAttribute("data-step", "1");
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 5, behavior: "instant" }),
  );
  await expect(page.locator("main.area")).toHaveAttribute("data-step", "5");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "2",
  );
});

test("tapping a number jumps to its workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.locator(".ws button").nth(4).tap();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "4",
  );
  await expect(page.locator(".ws button").nth(4)).toHaveAttribute(
    "aria-current",
    "true",
  );
});
