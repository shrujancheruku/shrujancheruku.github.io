import { expect, type Page, test } from "@playwright/test";

const DESCRIPTION = "I design and build. Give me a problem, not a spec.";
const area = (page: Page) => page.locator("main.area");
const boot = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(area(page)).toHaveAttribute("data-ready", "true");
};
const workspace = async (page: Page) =>
  Number(await area(page).getAttribute("data-workspace"));
const settle = (page: Page) => page.waitForTimeout(1100);
const flick = async (page: Page, dy: number) => {
  for (let d = dy; Math.abs(d) > 4; d = Math.trunc(d * 0.8)) {
    await page.mouse.wheel(0, d);
    await page.waitForTimeout(16);
  }
  await settle(page);
};

const ADDRESSES: [string, number, string][] = [
  ["/", 0, "Shrujan Cheruku — Product Engineer"],
  ["/work/", 1, "Projects — Shrujan Cheruku"],
  ["/timeline/", 2, "Timeline — Shrujan Cheruku"],
  ["/now/", 3, "Sabbatical — Shrujan Cheruku"],
  ["/contact/", 4, "Contact — Shrujan Cheruku"],
];

for (const [path, ws, title] of ADDRESSES) {
  test(`${path} loads straight into its workspace`, async ({ page }) => {
    await boot(page, path);
    expect(await workspace(page)).toBe(ws);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      DESCRIPTION,
    );
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

test("a project's address opens its step with the repository name as title", async ({
  page,
}) => {
  await boot(page, "/work/unmacos/");
  expect(await area(page).getAttribute("data-step")).toBe("2");
  await expect(page).toHaveTitle("unmacos — Shrujan Cheruku");
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
    "content",
    DESCRIPTION,
  );
});

test("scrolling changes address and title and adds no history entry", async ({
  page,
}) => {
  await boot(page, "/");
  const before = await page.evaluate(() => history.length);
  await page.mouse.move(640, 400);
  await flick(page, 120);
  expect(new URL(page.url()).pathname).toBe("/work/");
  await expect(page).toHaveTitle("Projects — Shrujan Cheruku");
  await flick(page, 120);
  expect(new URL(page.url()).pathname).toBe("/work/unmacos/");
  await expect(page).toHaveTitle("unmacos — Shrujan Cheruku");
  await page.keyboard.press("ArrowUp");
  await settle(page);
  await page.keyboard.press("ArrowUp");
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test("a workspace key or a status bar item adds an entry, and Back undoes it", async ({
  page,
}) => {
  await boot(page, "/");
  const before = await page.evaluate(() => history.length);
  await page.keyboard.press("3");
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  await page.locator('.ws button[data-workspace="4"]').click();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/contact/");
  expect(await page.evaluate(() => history.length)).toBe(before + 2);

  await page.goBack();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  expect(await workspace(page)).toBe(2);
  await expect(page).toHaveTitle("Timeline — Shrujan Cheruku");
  await page.goBack();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(await workspace(page)).toBe(0);
});

test("Back after scrolling past a jump returns to the jump's origin, not the scroll", async ({
  page,
}) => {
  await boot(page, "/");
  await page.keyboard.press("3");
  await settle(page);
  await page.keyboard.press("ArrowDown"); // timeline -> sabbatical, replaces
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/now/");
  await page.goBack();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("an unknown path boots the desktop with a not-found terminal offering the five workspaces", async ({
  page,
}) => {
  await boot(page, "/no/such/place/");
  await expect(page).toHaveTitle("Not found — Shrujan Cheruku");
  const term = page.locator('.pane[data-window="notfound"]');
  await expect(term).toBeVisible();
  await expect(term).toContainText("/no/such/place/");
  await expect(term.locator("a")).toHaveCount(5);

  await term.getByRole("link", { name: "timeline" }).click();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  await expect(page).toHaveTitle("Timeline — Shrujan Cheruku");
  await expect(term).toBeHidden();
  await page.goBack();
  await settle(page);
  await expect(page).toHaveTitle("Not found — Shrujan Cheruku");
  await expect(term).toBeVisible();
});
