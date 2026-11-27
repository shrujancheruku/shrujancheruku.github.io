import { expect, type Page, test } from "@playwright/test";
import { ready } from "./desktop";

test.describe.configure({ timeout: 120_000 });

const slot = (page: Page) =>
  page.locator('[data-composition="rapid-radiology"]');
const open = async (page: Page) => {
  await ready(page, "/work/rapid-radiology/");
};
const KEY = "■ from your findings · the rest is your template, word for word";

test("rapid-radiology types the findings, then both reports arrive, then it holds and restarts", async ({
  page,
}) => {
  await open(page);
  const scene = slot(page).locator(".scene");
  // record, in the page, when each state begins, so timings don't depend on polling
  await slot(page).evaluate((el) => {
    const log: { state: string; at: number }[] = [];
    (window as unknown as { rrStates: typeof log }).rrStates = log;
    const note = () => {
      const state = el.dataset.state ?? "";
      if (log.at(-1)?.state !== state)
        log.push({ state, at: performance.now() });
    };
    note();
    new MutationObserver(note).observe(el, {
      attributes: true,
      attributeFilter: ["data-state"],
    });
  });
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  const started = Date.now();
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 45_000,
  });
  const took = Date.now() - started;
  expect(took).toBeGreaterThan(6500);
  expect(took).toBeLessThan(45_000);

  await expect(scene.locator(".types span.on")).toHaveText("CT Chest");
  await expect(scene.locator(".f")).toContainText(
    "small left pleural effusion",
  );
  await expect(scene.locator(".openai .r div")).toHaveCount(9);
  await expect(scene.locator(".gemini .r div")).toHaveCount(10);
  for (const row of await scene.locator(".r div").all())
    await expect(row).toHaveCSS("opacity", "1");
  await expect(scene.locator(".key")).toHaveText(KEY);
  await expect(scene.locator(".key")).toHaveCSS("opacity", "0.7");
  // what came from the findings is in the accent, the template's own is dimmed
  const mark = scene.locator(".openai mark").first();
  const accent = await scene.evaluate(
    (el) => getComputedStyle(el).getPropertyValue("--ac").trim() || null,
  );
  expect(accent).not.toBeNull();
  const colours = await scene.locator(".openai").evaluate((p) => {
    const m = p.querySelector("mark") as HTMLElement;
    const plain = p.querySelectorAll(".r div")[1] as HTMLElement;
    return [getComputedStyle(m).color, getComputedStyle(plain).color];
  });
  expect(colours[0]).not.toBe(colours[1]);
  await expect(mark).toContainText("Comparison is made");

  // held about 7.5 s from the moment the end state is reached, then it restarts
  await expect(slot(page)).not.toHaveAttribute("data-state", "held", {
    timeout: 15_000,
  });
  const states = await page.evaluate(
    () =>
      (window as unknown as { rrStates: { state: string; at: number }[] })
        .rrStates,
  );
  const i = states.findIndex((s) => s.state === "held");
  const heldAt = states[i]?.at ?? Number.NaN;
  const after = states[i + 1];
  expect(after?.state).toBe("playing");
  const held = (after?.at ?? Number.NaN) - heldAt;
  // the hold's timers can only run late under load, never early
  expect(held).toBeGreaterThan(7400);
  expect(held).toBeLessThan(9500);
  await expect(scene.locator(".types span.on")).toHaveCount(0);
});

test("the panels fill the window with no panes: inputs across the top, the reports below", async ({
  page,
}) => {
  await open(page);
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".lbl")).toHaveCount(0);
  const box = async (sel: string) => {
    const b = await scene.locator(sel).boundingBox();
    if (!b) throw new Error(sel);
    return b;
  };
  const [input, openai, gemini] = [
    await box(".input"),
    await box(".openai"),
    await box(".gemini"),
  ];
  expect(openai.y).toBeGreaterThan(input.y + input.height - 2);
  expect(gemini.y).toBeCloseTo(openai.y, 0);
  expect(gemini.x).toBeGreaterThan(openai.x + openai.width - 2);
  const win = await scene.boundingBox();
  expect(win).not.toBeNull();
  if (win) {
    expect(input.width).toBeGreaterThan(win.width * 0.9);
    expect(gemini.x + gemini.width).toBeGreaterThan(win.x + win.width * 0.95);
    expect(openai.y + openai.height).toBeGreaterThan(win.y + win.height * 0.9);
  }
});

test("its still frame is the end state", async ({ page }) => {
  await open(page);
  await slot(page).evaluate((el) => {
    el.dataset.frame = "end";
  });
  await expect(slot(page)).toHaveAttribute("data-state", "frame");
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".f")).toContainText(
    "4mm right upper lobe nodule",
  );
  await expect(scene.locator(".openai .r div")).toHaveCount(9);
  await expect(scene.locator(".key")).toHaveCSS("opacity", "0.7");
  for (const row of await scene.locator(".r div").all())
    await expect(row).toHaveCSS("opacity", "1");
});

test("it follows the site theme live", async ({ page }) => {
  await open(page);
  const scene = slot(page).locator(".scene");
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 45_000,
  });
  const accent = () =>
    scene
      .locator(".openai mark")
      .first()
      .evaluate((e) => getComputedStyle(e).color);
  const before = await accent();
  await page.evaluate(() => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "paper"
        ? "tokyo-night"
        : "paper";
  });
  await expect.poll(accent).not.toBe(before);
});
