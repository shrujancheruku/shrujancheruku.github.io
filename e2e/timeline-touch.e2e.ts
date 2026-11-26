import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

const box = (page: import("@playwright/test").Page, id: string) =>
  page.$eval(`[data-window="${id}"]`, (e) => {
    const area = document.querySelector("main.area")?.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return {
      top: r.top,
      shown: getComputedStyle(e).display !== "none",
      w: r.width / (area?.width ?? 1),
      h: r.height / (area?.height ?? 1),
    };
  });

test("timeline, then education, then the lower window; opening gives education the workspace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.locator(".ws button").nth(2).tap();
  await page.waitForTimeout(1300);
  const [t, e, s] = await Promise.all(
    ["timeline", "education", "skills"].map((id) => box(page, id)),
  );
  expect(t?.top).toBeLessThan(e?.top ?? 0);
  expect(e?.top).toBeLessThan(s?.top ?? 0);

  await page.locator("[data-disclosure=education]").click();
  await page.waitForTimeout(1300);
  expect((await box(page, "timeline")).shown).toBe(false);
  expect((await box(page, "skills")).shown).toBe(false);
  const open = await box(page, "education");
  expect(Math.round(open.h * 100)).toBe(100);
  expect(Math.round(open.w * 100)).toBe(100);
});
