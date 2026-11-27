import { expect, test } from "@playwright/test";
import {
  expectScreens,
  expectWorkspace,
  goTo,
  phones,
  ready,
  settle,
  shown,
} from "./desktop";
import { typed, unseen } from "./fit";

test.beforeEach(async ({ page }) => {
  await ready(page, "/");
  await goTo(page, "sabbatical");
  await settle(page);
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

test("the copy window reads the dates, the heading, the reason, the four lines and the foot", async ({
  page,
}) => {
  const copy = page.locator('.pane[data-window="sabbatical"]');
  await expect(copy).toContainText("Nov 2025 → Now");
  await expect(copy.locator("h2")).toHaveText("sabbatical");
  await expect(copy.locator(".reason")).toHaveText(
    "After a decade of coding for work or class every day, I needed a break.",
  );
  await expect(copy.locator("li")).toHaveText([
    "travelling the world",
    "time with family",
    "helping friends launch their products",
    "building things for myself",
  ]);
  await expect(copy.locator(".foot")).toHaveText(
    "10/10 would recommend to a friend.",
  );
});

test("the first line ends with six flag images, in order, drawn from files", async ({
  page,
}) => {
  const flags = page
    .locator('.pane[data-window="sabbatical"] li')
    .first()
    .locator("img");
  await expect(flags).toHaveCount(6);
  expect(
    await flags.evaluateAll((els) => els.map((e) => e.getAttribute("alt"))),
  ).toEqual([
    "United Kingdom",
    "Japan",
    "Switzerland",
    "India",
    "Vietnam",
    "Indonesia",
  ]);
  const drawn = await flags.evaluateAll((els) =>
    els.map((e) => {
      const i = e as HTMLImageElement;
      return (
        i.complete &&
        i.naturalWidth > 0 &&
        new URL(i.src).origin === location.origin
      );
    }),
  );
  expect(drawn).toEqual([true, true, true, true, true, true]);
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

// On a phone the copy and the four photos are one screen: nothing to swipe to,
// and nothing cut off. Pixel 7 and iPhone 14 are the phones; 375x667 is the
// smallest the site is held to.
for (const [name, phone] of phones("Pixel 7", "375x667")) {
  test(`on ${name} the copy and the four photos are one screen, with nothing cut off`, async ({
    browser,
  }) => {
    const page = await browser.newPage(phone);
    await ready(page, "/");
    await goTo(page, "sabbatical", "click");
    await expectWorkspace(page, "sabbatical");
    await settle(page);
    await expectScreens(page, 1);
    expect(await shown(page)).toEqual([
      "photo-1",
      "photo-2",
      "photo-3",
      "photo-4",
      "sabbatical",
    ]);
    await typed(page);
    expect(await unseen(page)).toEqual([]);
    await page.close();
  });
}
