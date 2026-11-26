import { expect, type Page, test } from "@playwright/test";
import { ready } from "./helpers";

const NAMES = [
  "tokyo-night",
  "gruvbox",
  "paper",
  "issho-light",
  "issho-dark",
  "nord",
  "rose-pine",
  "starship",
];

/** The status-bar icon's and the menu swatch's computed background for the current theme. */
async function fills(page: Page) {
  return page.evaluate(() => {
    const theme = document.documentElement.dataset.theme;
    const icon = document.querySelector(".ib.th i");
    const swatch = document.querySelector(`[data-theme-set="${theme}"] i`);
    return {
      theme,
      icon: icon ? getComputedStyle(icon).backgroundImage : null,
      swatch: swatch ? getComputedStyle(swatch).backgroundImage : null,
    };
  });
}

/** Every theme's icon matches its own swatch, however it was chosen. */
async function expectMatching(page: Page, how: string) {
  const f = await fills(page);
  expect(f.icon, `${f.theme} icon ${how}`).toBe(f.swatch);
  expect(f.icon, `${f.theme} icon ${how}`).toContain("linear-gradient");
}

for (const [label, width] of [
  ["wide", 1280],
  ["phone", 390],
] as const) {
  test.describe(`theme icon at ${label} width`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 800 } });

    test("every theme chosen from the menu matches its swatch", async ({
      page,
    }) => {
      await ready(page);
      for (const name of NAMES) {
        const theme = page.getByRole("button", { name: "theme" });
        if ((await theme.getAttribute("aria-expanded")) !== "true")
          await theme.click();
        await page.getByRole("menuitemradio", { name }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", name);
        await expectMatching(page, "chosen from the menu");
      }
    });

    test("every theme reached with T matches its swatch", async ({ page }) => {
      await ready(page);
      for (let i = 0; i < NAMES.length; i++) {
        await page.keyboard.press("t");
        await expectMatching(page, "reached with T");
      }
    });

    test("every theme after a reload matches its swatch", async ({ page }) => {
      await ready(page);
      for (const name of NAMES) {
        await page.evaluate((n) => localStorage.setItem("theme", n), name);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", name);
        await expectMatching(page, "after reload");
      }
    });
  });
}
