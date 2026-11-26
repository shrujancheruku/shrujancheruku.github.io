import { expect, type Page, test } from "@playwright/test";
import { area, SWIPES, settle, swipe, warmUpTouch } from "./helpers";

const win = (page: Page, id: string) => page.locator(`[data-window="${id}"]`);
const box = (page: Page, id: string) => win(page, id).boundingBox();

test.describe("arriving directly at /contact/", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact/");
    await expect(area(page)).toHaveAttribute("data-ready", "true");
    await expect(area(page)).toHaveAttribute("data-workspace", "5");
  });

  test("the terminal types $ contact, then the contact line and the four channels", async ({
    page,
  }) => {
    const term = win(page, "contact");
    await expect(term.locator(".row")).toHaveText(["$ contact"], {
      timeout: 4000,
    });
    await expect(term).toContainText(
      "Feel free to get in touch. I always love hearing what people are building, and whether I can help.",
    );
    const rows = term.locator(".channel");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("email");
    await expect(rows.nth(0)).toContainText("shrujancheruku@gmail.com");
    await expect(rows.nth(1)).toContainText("linkedin.com/in/shrujancheruku");
    await expect(rows.nth(2)).toContainText("github.com/shrujancheruku");
    await expect(rows.nth(3)).toContainText("shrujan-cheruku-resume.pdf");
  });

  test("the channels are real links from the first frame", async ({ page }) => {
    const term = win(page, "contact");
    await expect(
      term.locator('a[href="mailto:shrujancheruku@gmail.com"]'),
    ).toHaveCount(1);
    const resume = term.locator('a[href="/shrujan-cheruku-resume.pdf"]');
    await expect(resume).toHaveCount(1);
    // the resume downloads rather than leaving the desktop
    await expect(resume).toHaveAttribute("download", "");

    const linkedin = term.locator(
      'a[href="https://www.linkedin.com/in/shrujancheruku"]',
    );
    const github = term.locator('a[href="https://github.com/shrujancheruku"]');
    await expect(linkedin).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(linkedin).toHaveAttribute("rel", /noopener/);
    await expect(github).toHaveAttribute("rel", /noopener/);
  });

  test("no phone number, form, or availability on the page", async ({
    page,
  }) => {
    const text = (await page.locator("main.area").textContent()) ?? "";
    expect(text).not.toMatch(/availab|hiring|booking|phone|\+\d{6,}/i);
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test("copying the email prints copied to clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(page.url()).origin,
    });
    await win(page, "contact").getByRole("button", { name: /copy/i }).click();
    await expect(win(page, "contact")).toContainText("copied to clipboard");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe("shrujancheruku@gmail.com");
  });

  test("the ~/now window does not return; the name and whoami windows do", async ({
    page,
  }) => {
    await expect(win(page, "now")).toBeHidden();
    await expect(win(page, "name")).toBeVisible();
    await expect(win(page, "term")).toBeVisible();
  });
});

test("returning to contact after leaving shows the command at once, without typing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  // key 6 jumps to the contact workspace
  await page.keyboard.press("6");
  await expect(area(page)).toHaveAttribute("data-workspace", "5");
  // the first arrival types the command; wait for it to finish
  await expect(win(page, "contact").locator(".row")).toHaveText(["$ contact"], {
    timeout: 4000,
  });

  await page.keyboard.press("1");
  await expect(area(page)).toHaveAttribute("data-workspace", "0");
  await page.keyboard.press("6");
  await expect(area(page)).toHaveAttribute("data-workspace", "5");
  // already typed once in this visit: the row is there at once
  await expect(win(page, "contact").locator(".row")).toHaveText(["$ contact"], {
    timeout: 100,
  });
});

test("on touch, contact is one screen: the terminal, and a forward swipe stays put", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/contact/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
  // contact is the last step and one screen: no second screen for the name
  await expect(area(page)).toHaveAttribute("data-screens", "1");
  await expect(area(page)).toHaveAttribute("data-screen", "0");
  expect(await box(page, "contact")).not.toBeNull();
  expect(await box(page, "name")).toBeNull();
  expect(await box(page, "term")).toBeNull();
  await warmUpTouch(page);
  // a forward swipe on the last screen stays put
  await swipe(page, 1, SWIPES[0] as (typeof SWIPES)[number]);
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-screen", "0");
  await expect(area(page)).toHaveAttribute("data-workspace", "5");
  expect(await box(page, "contact")).not.toBeNull();
  expect(await box(page, "name")).toBeNull();
  expect(new URL(page.url()).pathname).toBe("/contact/");
  await context.close();
});
