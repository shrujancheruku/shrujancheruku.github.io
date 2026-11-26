// Screens: what a swipe steps through on touch. Pure, no DOM.
//
// A step holds one or more screens on a phone. The wide desktop shows a whole
// step at once; a phone screen is too small for most of them, and nothing may
// scroll, so a step is split into screens that each fit: its layouts one after
// another (the stack beside the copy, then the composition), and a window with
// more entries than fit one screen (the timeline) over as many screens as its
// entries need. The step, and so the address, stays the same across them.

import type { Layout } from "./workspaces";

/**
 * Split entries into pages that fit. `heights` are the entries' heights in
 * order, `capacity` the room one page has. Entries keep their order and none
 * is dropped; an entry taller than a page has a page to itself. At least one
 * page is returned, so a window with no entries still has a screen.
 */
export function paginate(
  heights: readonly number[],
  capacity: number,
): number[][] {
  const pages: number[][] = [];
  let used = 0;
  for (const [i, h] of heights.entries()) {
    const page = pages[pages.length - 1];
    if (page && used + h <= capacity) {
      page.push(i);
      used += h;
    } else {
      pages.push([i]);
      used = h;
    }
  }
  return pages.length > 0 ? pages : [[]];
}

/** One screen: a tiling, and the page each paged window shows on it. */
export interface Screen {
  layout: Layout;
  /** Page index (0-based) by window id, for the paged windows in the layout. */
  pages: Readonly<Record<string, number>>;
}

/**
 * A step's layouts, each repeated for the pages of its paged windows. A
 * layout is as many screens as its window with the most pages has; a window
 * with fewer pages holds its last page. `pageCounts` has the windows that are
 * paged, by id.
 */
export function expandScreens(
  layouts: readonly Layout[],
  pageCounts: Readonly<Record<string, number>>,
): Screen[] {
  return layouts.flatMap((layout) => {
    const paged = Object.keys(layout).filter((id) => id in pageCounts);
    const counts = paged.map((id) => Math.max(1, pageCounts[id] ?? 1));
    const length = Math.max(1, ...counts);
    return Array.from({ length }, (_, k) => ({
      layout,
      pages: Object.fromEntries(
        paged.map((id, i) => [id, Math.min(k, (counts[i] ?? 1) - 1)]),
      ),
    }));
  });
}

/** Where the visitor is: a step, and a screen inside it. */
export interface Position {
  step: number;
  screen: number;
}

/**
 * The position one screen away, held at the first and the last. `count` says
 * how many screens a step has; a step with one is a plain step move.
 */
export function moveBy(
  at: Position,
  direction: 1 | -1,
  count: (step: number) => number,
  steps: number,
): Position {
  const screen = at.screen + direction;
  if (screen >= 0 && screen < count(at.step)) return { step: at.step, screen };
  const step = at.step + direction;
  if (step < 0 || step >= steps) return at;
  return { step, screen: direction === 1 ? 0 : count(step) - 1 };
}

/** The focused window: the step's, if the screen shows it, else the screen's first. */
export function focusAmong(layout: Layout, preferred: string): string {
  return preferred in layout
    ? preferred
    : (Object.keys(layout)[0] ?? preferred);
}

/** What a screen shows: its layout, and the first entry of a paged window on it. */
export interface Anchor {
  layout: Layout;
  /** A paged window on the screen, and the first entry it shows; absent if none. */
  window?: string;
  entry?: number;
}

/** The entries a paged window shows on a screen, as measured now. */
export type EntriesOf = (screen: Screen, id: string) => readonly number[];

/** Pin down what `screen` shows, to find it again after the pages change. */
export function anchorOf(screen: Screen, entriesOf: EntriesOf): Anchor {
  for (const id of Object.keys(screen.pages)) {
    const entry = entriesOf(screen, id)[0];
    if (entry !== undefined)
      return { layout: screen.layout, window: id, entry };
  }
  return { layout: screen.layout };
}

/**
 * The screen that now shows what `anchor` pinned: the one with the same
 * layout whose paged window holds the anchored entry. A screen with the same
 * layout stands in when none holds it, and the first screen when no layout
 * matches.
 */
export function screenHolding(
  screens: readonly Screen[],
  anchor: Anchor,
  entriesOf: EntriesOf,
): number {
  const same = screens.flatMap((s, i) =>
    s.layout === anchor.layout ? [i] : [],
  );
  const { window, entry } = anchor;
  if (window !== undefined && entry !== undefined) {
    const holding = same.find((i) => {
      const s = screens[i];
      return s !== undefined && entriesOf(s, window).includes(entry);
    });
    if (holding !== undefined) return holding;
  }
  return same[0] ?? 0;
}
