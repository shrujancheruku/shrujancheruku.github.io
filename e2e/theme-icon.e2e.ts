import { expect, type Page, test } from "@playwright/test";
import { swatch, THEME_NAMES, THEMES } from "../src/lib/themes";
import { ready } from "./desktop";

const NAMES = THEME_NAMES;

/** Each theme's swatch() as the browser computes it, so it compares with getComputedStyle. */
async function expectedSwatches(page: Page): Promise<Record<string, string>> {
  const css = Object.fromEntries(NAMES.map((n) => [n, swatch(THEMES[n])]));
  return page.evaluate((css) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const [n, c] of Object.entries(css)) {
      probe.style.backgroundImage = c;
      out[n] = getComputedStyle(probe).backgroundImage;
    }
    probe.remove();
    return out;
  }, css);
}

/** The computed background of every swatch in the theme menu, by theme. */
async function menuSwatches(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-theme-set]")].map(
        (b) => [
          b.dataset.themeSet ?? "",
          getComputedStyle(b.querySelector("i") as Element).backgroundImage,
        ],
      ),
    ),
  );
}

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

/** Every theme's icon is swatch(<the active theme>) and matches its menu swatch, however it was chosen. */
async function expectMatching(page: Page, how: string) {
  const expected = await expectedSwatches(page);
  const f = await fills(page);
  expect(f.icon, `${f.theme} icon ${how}`).toBe(expected[f.theme ?? ""]);
  expect(f.icon, `${f.theme} icon ${how}`).toBe(f.swatch);
}

for (const [label, width] of [
  ["wide", 1280],
  ["phone", 390],
] as const) {
  test.describe(`theme icon at ${label} width`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 800 } });

    test("each menu swatch shows its own theme, whatever the active theme", async ({
      page,
    }) => {
      await ready(page);
      const expected = await expectedSwatches(page);
      for (const name of NAMES) {
        await page.evaluate((n) => localStorage.setItem("theme", n), name);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", name);
        const menu = await menuSwatches(page);
        expect(Object.keys(menu), `menu under ${name}`).toEqual([...NAMES]);
        expect(new Set(Object.values(menu)).size, `menu under ${name}`).toBe(
          NAMES.length,
        );
        for (const n of NAMES)
          expect(menu[n], `${n} swatch under ${name}`).toBe(expected[n]);
      }
    });

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
