import { expect, type Page } from "@playwright/test";

// What a phone screen fails to show. On a phone nothing scrolls, so every
// window must fit its box: these read the windows on show and return what is
// cut off, as strings, none when all of it shows.

/**
 * Waits until the skill bars rest. They grow in for about two seconds after a
 * re-tile ends, the joke bar overshooting its track, so a window read part way
 * is read at a width it only has for a moment.
 */
export const barsRest = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !document.querySelector(
              '[data-window="skills"][data-bars="growing"]',
            ),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

/** What is cut off in every window on show: strings, none when all fits. */
export const cutOff = async (page: Page) => {
  // widths depend on the web fonts: read them once they have all loaded
  await page.evaluate(() => document.fonts.ready);
  await barsRest(page);
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const pane of document.querySelectorAll<HTMLElement>(".pane")) {
      if (getComputedStyle(pane).display === "none") continue;
      const id = pane.dataset.window;
      const win = pane.querySelector<HTMLElement>(".win");
      const body = pane.querySelector<HTMLElement>(".body");
      if (!win || !body) continue;
      const box = win.getBoundingClientRect();
      const slot = pane.querySelector<HTMLElement>("[data-slot]");
      if (slot) {
        // a composition: its scene fits, and so does each of its panes
        const scene = slot.querySelector<HTMLElement>(".scene");
        if (!scene) continue;
        if (scene.scrollHeight > scene.clientHeight + 1)
          problems.push(
            `${id}: scene ${scene.scrollHeight}>${scene.clientHeight}`,
          );
        const s = scene.getBoundingClientRect();
        for (const c of scene.children) {
          // a pane the touch layout hides has no box
          if (getComputedStyle(c).display === "none") continue;
          const r = c.getBoundingClientRect();
          if (
            r.bottom > s.bottom + 1 ||
            r.right > s.right + 1 ||
            r.top < s.top - 1 ||
            r.left < s.left - 1
          )
            problems.push(`${id}: ${c.className} outside the scene`);
        }
        continue;
      }
      for (const el of [body, ...body.querySelectorAll<HTMLElement>("*")]) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || el.closest("[hidden]")) continue;
        if (
          el === body ||
          cs.overflowY !== "visible" ||
          cs.overflowX !== "visible"
        ) {
          if (el.scrollHeight > el.clientHeight + 1)
            problems.push(
              `${id}: ${el.tagName}.${el.className} ${el.scrollHeight}>${el.clientHeight}`,
            );
          if (el.scrollWidth > el.clientWidth + 1)
            problems.push(
              `${id}: ${el.tagName}.${el.className} wide ${el.scrollWidth}>${el.clientWidth}`,
            );
        }
        // text that sits outside the window's box is cut off
        if (el.children.length === 0 && el.textContent?.trim()) {
          const r = el.getBoundingClientRect();
          if (
            r.height > 0 &&
            (r.bottom > box.bottom + 1 || r.right > box.right + 1)
          )
            problems.push(`${id}: "${el.textContent.slice(0, 24)}" outside`);
        }
      }
    }
    return problems;
  });
};

/** Waits until every typed terminal on show has typed all it will. */
export const typed = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("[data-terminal]")]
            .filter(
              (t) => t.closest<HTMLElement>(".pane")?.style.display !== "none",
            )
            .every((t) => {
              const exchanges: { replies: string[] }[] = JSON.parse(
                t.dataset.terminal ?? "[]",
              );
              const rows = exchanges.reduce(
                (n, e) => n + 1 + e.replies.length,
                0,
              );
              return (
                t.dataset.typing === "" &&
                (t.querySelector(".log")?.children.length ?? 0) === rows
              );
            }),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);

/**
 * What a visitor cannot see on the screen: windows on show that overlap one
 * another, and text inside a window that lies outside the window's visible box
 * or outside a box that clips it inside the window (a panel of a
 * composition). Text a composition marks `data-runs-off` (a terminal pane's
 * code lines, which run off its edge as a real terminal's do) is left out.
 */
export const hidden = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    type Box = { top: number; right: number; bottom: number; left: number };
    /** The box inside an element's border, where its clipped content shows. */
    const inner = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      const he = el as HTMLElement;
      const top = r.top + he.clientTop;
      const left = r.left + he.clientLeft;
      return {
        top,
        left,
        bottom: top + he.clientHeight,
        right: left + he.clientWidth,
      };
    };
    const shown = [...document.querySelectorAll<HTMLElement>(".pane")].filter(
      (p) => getComputedStyle(p).display !== "none",
    );

    // no two windows on a screen overlap
    const wins = shown.map((p) => ({
      id: p.dataset.window ?? "?",
      box: p.querySelector(".win")?.getBoundingClientRect(),
    }));
    for (const [i, a] of wins.entries())
      for (const b of wins.slice(i + 1)) {
        if (!a.box || !b.box) continue;
        const x =
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
        const y =
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
        if (x > 1 && y > 1) problems.push(`${a.id} overlaps ${b.id}`);
      }

    /** Whether nothing of the element shows: not displayed, hidden or see-through. */
    const invisible = (el: Element | null, stop: Element): boolean => {
      for (let e = el; e && e !== stop.parentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (
          cs.display === "none" ||
          cs.visibility === "hidden" ||
          Number(cs.opacity) === 0 ||
          (e as HTMLElement).hidden
        )
          return true;
      }
      return false;
    };

    for (const pane of shown) {
      const id = pane.dataset.window ?? "?";
      const win = pane.querySelector(".win");
      if (!win) continue;
      const scene = !!win.querySelector("[data-slot]");
      const walker = document.createTreeWalker(win, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const parent = node.parentElement;
        if (!text || !parent || parent.closest("[data-runs-off]")) continue;
        if (invisible(parent, win)) continue;
        // text on its way somewhere (a pane sliding, a page scrolling) is
        // judged once it rests
        let moving = false;
        for (
          let e: Element | null = parent;
          e && !moving;
          e = e.parentElement
        ) {
          moving = e
            .getAnimations()
            .some(
              (a) =>
                a.playState === "running" &&
                a.effect?.getComputedTiming().endTime !== Infinity,
            );
          if (e === win) break;
        }
        if (moving) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        let own: Box = range.getBoundingClientRect();
        // an ellipsis shortens text to its element's box on purpose: what
        // shows is the text inside that box, and the clipping above it counts
        let from: Element = parent;
        for (
          let e: Element | null = parent;
          e && e !== win;
          e = e.parentElement
        ) {
          const cs = getComputedStyle(e);
          if (
            cs.textOverflow === "ellipsis" &&
            cs.overflowX !== "visible" &&
            cs.display !== "inline"
          ) {
            const r = e.getBoundingClientRect();
            own = {
              top: Math.max(own.top, r.top),
              left: Math.max(own.left, r.left),
              bottom: Math.min(own.bottom, r.bottom),
              right: Math.min(own.right, r.right),
            };
            from = e.parentElement ?? win;
            break;
          }
        }
        if (own.right - own.left <= 0 || own.bottom - own.top <= 0) continue;
        // the boxes that clip it: its own, the window's, and every clipping box
        // between (a fieldset's legend sits on its border, inside its border box)
        let fits = true;
        let clip = "";
        for (let e: Element | null = from; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          const clips =
            e === win ||
            cs.overflowX !== "visible" ||
            cs.overflowY !== "visible";
          if (clips) {
            const legend = e.tagName === "FIELDSET" && parent.closest("legend");
            const box = legend ? e.getBoundingClientRect() : inner(e);
            const within =
              own.top >= box.top - 1 &&
              own.left >= box.left - 1 &&
              own.bottom <= box.bottom + 1 &&
              own.right <= box.right + 1;
            const apart =
              own.bottom <= box.top ||
              own.top >= box.bottom ||
              own.right <= box.left ||
              own.left >= box.right;
            // a composition's rows scrolled or tiled wholly out of a panel are
            // not on show; a row half in it is cut off
            if (apart && scene) break;
            if (!within) {
              fits = false;
              clip = e === win ? "the window" : `${e.tagName}.${e.className}`;
              break;
            }
          }
          if (e === win) break;
        }
        if (!fits)
          problems.push(`${id}: "${text.slice(0, 24)}" outside ${clip}`);
      }
    }
    return problems;
  });

/** Everything on the screen a visitor cannot see; none when all shows. */
export const unseen = async (page: Page): Promise<string[]> => [
  ...(await cutOff(page)),
  ...(await hidden(page)),
];
