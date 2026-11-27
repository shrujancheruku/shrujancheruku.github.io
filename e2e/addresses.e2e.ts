import { expect, type Page, test } from "@playwright/test";
import { area, ready as boot, flick, settle } from "./helpers";

const DESCRIPTION =
  "I design things and I build them. Give me a problem, not a spec.";
const workspace = async (page: Page) =>
  Number(await area(page).getAttribute("data-workspace"));

const ADDRESSES: [string, number, string][] = [
  ["/", 0, "Shrujan Cheruku — Senior Product Engineer"],
  ["/timeline/", 1, "Timeline — Shrujan Cheruku"],
  ["/work/", 2, "Projects — Shrujan Cheruku"],
  ["/about/", 3, "About — Shrujan Cheruku"],
  ["/now/", 4, "Sabbatical — Shrujan Cheruku"],
  ["/contact/", 5, "Contact — Shrujan Cheruku"],
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
  expect(await area(page).getAttribute("data-step")).toBe("5");
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
  await flick(page, { x: 640, y: 400 });
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  await expect(page).toHaveTitle("Timeline — Shrujan Cheruku");
  // the timeline scrolls its own entries under a wheel, so leave it by key
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/work/");
  await expect(page).toHaveTitle("Projects — Shrujan Cheruku");
  await flick(page, { x: 640, y: 400 });
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/work/rapid-radiology/");
  await expect(page).toHaveTitle("rapid-radiology — Shrujan Cheruku");
  await page.keyboard.press("ArrowUp");
  await settle(page);
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
  await page.keyboard.press("2");
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  await page.locator('.ws button[data-workspace="5"]').click();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/contact/");
  expect(await page.evaluate(() => history.length)).toBe(before + 2);

  await page.goBack();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/timeline/");
  expect(await workspace(page)).toBe(1);
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
  await page.keyboard.press("4");
  await settle(page);
  await page.keyboard.press("ArrowDown"); // about -> sabbatical, replaces
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/now/");
  await page.goBack();
  await settle(page);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("an unknown path boots the desktop with a not-found terminal offering the six workspaces", async ({
  page,
}) => {
  await boot(page, "/no/such/place/");
  await expect(page).toHaveTitle("Not found — Shrujan Cheruku");
  const term = page.locator('.pane[data-window="notfound"]');
  await expect(term).toBeVisible();
  await expect(term).toContainText("/no/such/place/");
  await expect(term.locator("a")).toHaveCount(6);

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
