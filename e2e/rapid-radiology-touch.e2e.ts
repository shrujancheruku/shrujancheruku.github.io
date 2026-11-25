import { devices, expect, type Page, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });
test.describe.configure({ timeout: 60_000 });

const slot = (page: Page) =>
  page.locator('[data-composition="rapid-radiology"]');
const open = async (page: Page) => {
  await page.goto("/work/rapid-radiology/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
};

test("two beats: the findings are typed, then the OpenAI report takes their place; Gemini is dropped", async ({
  page,
}) => {
  await open(page);
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".f")).toBeVisible();
  await expect(scene.locator(".openai")).toBeHidden();
  await expect(scene.locator(".gemini")).toBeHidden();
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 40_000,
  });
  await expect(scene.locator(".openai")).toBeVisible();
  await expect(scene.locator(".f")).toBeHidden();
  await expect(scene.locator(".gemini")).toBeHidden();
  await expect(scene.locator(".key")).toBeVisible();
  await expect(scene.locator(".key")).toContainText("from your findings");
  const wide = scene.locator(".key .wide");
  await expect(wide).toBeHidden();
});
