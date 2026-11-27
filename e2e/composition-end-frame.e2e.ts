import { expect, type Page, test } from "@playwright/test";
import { compositions } from "../src/compositions/registry";
import { ready } from "./desktop";

// A composition's live scene, once play() has finished, is its card frame.
// Compositions that cannot meet that yet are skipped by name, with the reason:
// issho's play() ends on its last section, not its card frame (top), and
// unmacos's play() loops and never reaches held.
const SKIPPED: Record<string, string> = {
  issho: "play() ends on the last section; its card frame is the top",
  unmacos: "play() loops forever, so it never reaches held",
};

// a composition holds its end state, then restarts (rapid-radiology holds 7.5 s);
// the play can take a while on a busy machine
test.describe.configure({ timeout: 90_000 });

const slot = (page: Page, name: string) =>
  page.locator(`[data-slot][data-composition="${name}"]`);

/** The scene's markup, the DOM the card frame is judged on. */
const sceneHtml = (page: Page, name: string) =>
  slot(page, name)
    .locator(".scene")
    .evaluate((el) => el.outerHTML);

for (const name of Object.keys(compositions)) {
  const skip = SKIPPED[name];
  test(`${name}: the scene held at the end of play() is its card frame`, async ({
    page,
  }) => {
    test.skip(skip !== undefined, skip);
    await ready(page, `/work/${name}/`);
    await expect(slot(page, name)).toHaveAttribute("data-state", "held", {
      timeout: 45_000,
    });
    const held = await sceneHtml(page, name);

    // the card's frame: the same slot shown in its card frame
    await slot(page, name).evaluate((el) => {
      (el as HTMLElement).dataset.frame = "card";
    });
    await expect(slot(page, name)).toHaveAttribute("data-state", "frame");
    expect(await sceneHtml(page, name)).toBe(held);
  });
}
