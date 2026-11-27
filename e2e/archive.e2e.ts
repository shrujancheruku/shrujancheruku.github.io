import { expect, type Page, test } from "@playwright/test";
import { area, flick, ready, settle } from "./helpers";

const shown = (page: Page) =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window)
      .sort(),
  );
const box = async (page: Page, id: string) => {
  const b = await page.locator(`[data-window="${id}"]`).boundingBox();
  if (!b) throw new Error(`no box for ${id}`);
  return b;
};
const archive = (page: Page) => page.locator('[data-window="archive"]');

test("the line under the last featured project opens the archive; esc closes it and the address returns", async ({
  page,
}) => {
  await ready(page, "/work/unmacos/");
  await page.locator("#archive-more").click();
  await expect(page).toHaveURL(/\/archive\/$/);
  await expect(page).toHaveTitle("Archive — Shrujan Cheruku");
  await settle(page);
  expect(await shown(page)).toContain("archive");
  await expect(archive(page)).toHaveClass(/focus/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
  await settle(page);
  expect(await shown(page)).not.toContain("archive");
  await expect(page).toHaveTitle("unmacos — Shrujan Cheruku");
});

test("it takes the right 58%, the workspace squeezes into the left 42%", async ({
  page,
}) => {
  await ready(page, "/work/unmacos/");
  const area_ = (await area(page).boundingBox()) ?? { width: 0, x: 0 };
  await page.locator("#archive-more").click();
  await settle(page);
  const a = await box(page, "archive");
  const c = await box(page, "comp-4");
  expect(a.width / area_.width).toBeCloseTo(0.58, 1);
  expect((a.x - area_.x) / area_.width).toBeCloseTo(0.42, 1);
  expect(c.x + c.width).toBeLessThanOrEqual(a.x + 1);
});

test("the stack's +N archive line opens it, and clicking it again closes it", async ({
  page,
}) => {
  await ready(page, "/work/");
  const opener = page.locator("#archive-stack");
  await expect(opener).toHaveText("+3 archive");
  await opener.click();
  await settle(page);
  await expect(page).toHaveURL(/\/archive\/$/);
  expect(await shown(page)).toContain("archive");
  await opener.click();
  await settle(page);
  expect(await shown(page)).not.toContain("archive");
  await expect(page).toHaveURL(/\/work\/$/);
});

test("there is no status bar item, and the heading and entries are as decided", async ({
  page,
}) => {
  await ready(page, "/archive/");
  await expect(page.locator("header.bar").getByText(/archive/i)).toHaveCount(0);
  await expect(archive(page).locator(".kick")).toHaveText("~/archive · 3");
  await expect(archive(page).locator("h2")).toHaveText("archive");
  await expect(archive(page).locator(".close")).toHaveText("esc ✕");
  const first = archive(page).locator("[data-entry]").first();
  await expect(first.locator(".name")).toHaveAttribute(
    "href",
    /github\.com\/shrujancheruku\/claude-orchestrate/,
  );
  await expect(first.locator(".pitch")).not.toBeEmpty();
  await expect(archive(page).locator("img")).toHaveCount(0);
  const facts = await first.locator(".facts a").allTextContents();
  expect(facts).toContain("repository ↗");
  // the aidan-landing-page entry has a live site, claude-orchestrate none
  expect(facts).not.toContain("live ↗");
});

test("✕ closes it", async ({ page }) => {
  await ready(page, "/work/unmacos/");
  await page.locator("#archive-more").click();
  await settle(page);
  await archive(page).locator(".close").click();
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
  await settle(page);
  expect(await shown(page)).not.toContain("archive");
});

test("scrolling to another step closes it and the address follows the step", async ({
  page,
}) => {
  await ready(page, "/work/unmacos/");
  await page.locator("#archive-more").click();
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await shown(page)).not.toContain("archive");
  await expect(page).toHaveURL(/\/timeline\/$/);
});

test("Back after opening closes it; the entry is a history entry", async ({
  page,
}) => {
  await ready(page, "/work/unmacos/");
  await page.locator("#archive-more").click();
  await settle(page);
  await page.goBack();
  await settle(page);
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
  expect(await shown(page)).not.toContain("archive");
  await page.goForward();
  await settle(page);
  await expect(page).toHaveURL(/\/archive\/$/);
  expect(await shown(page)).toContain("archive");
});

test("/archive/ loads the last featured project with the archive open", async ({
  page,
}) => {
  await ready(page, "/archive/");
  await expect(page).toHaveTitle("Archive — Shrujan Cheruku");
  expect(await shown(page)).toEqual(
    ["archive", "comp-4", "copy-4", "stack"].sort(),
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/work\/unmacos\/$/);
});

test("/work/<archive slug>/ opens the archive on that entry, titled and described by it", async ({
  page,
}) => {
  await ready(page, "/work/truecrypt-steganography/");
  await expect(page).toHaveTitle("TrueCrypt-Steganography — Shrujan Cheruku");
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  const pitch = await archive(page)
    .locator('[data-entry="TrueCrypt-Steganography"] .pitch')
    .textContent();
  expect(description).toBe(pitch);
  expect(await shown(page)).toContain("archive");
  await expect(
    archive(page).locator('[data-entry="TrueCrypt-Steganography"]'),
  ).toHaveAttribute("aria-current", "true");
});

test("a long list scrolls inside the window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await ready(page, "/archive/");
  const scrollable = await archive(page)
    .locator("[data-archive]")
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrollable).toBe(true);
});

test("a flick that scrolls the archive to its end does not also step; the next flick does", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await ready(page, "/archive/");
  await settle(page);
  const list = archive(page).locator("[data-archive]");
  // from the top, the list is shorter than the flick: it reaches its end part way
  await list.evaluate((el) => {
    el.scrollTop = 0;
  });
  expect(
    await list.evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThan(400);
  const step = await area(page).getAttribute("data-step");
  const lb = await list.boundingBox();
  const over = {
    x: (lb?.x ?? 0) + (lb?.width ?? 0) / 2,
    y: (lb?.y ?? 0) + (lb?.height ?? 0) / 2,
  };
  await flick(page, over);
  await expect
    .poll(() =>
      list.evaluate(
        (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
      ),
    )
    .toBe(true);
  await settle(page);
  expect(await area(page).getAttribute("data-step")).toBe(step);

  await flick(page, over);
  await expect(area(page)).not.toHaveAttribute("data-step", step ?? "");
});
