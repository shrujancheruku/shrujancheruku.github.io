// Paged windows: on touch a window with more entries than fit one screen shows
// them a page at a time (src/lib/screens.ts decides the pages; this measures).
//
// The markup: a `[data-paged-root]` box with the window's room, holding any
// fixed chrome (a heading) and one `[data-paged]` list. The list's direct
// children are the entries, and they carry no margin of their own.
//
// Kept for the timeline step's two phone screens (#108) and for the archive's
// pages on touch. src/lib/screens.ts says which windows page and why the
// multi-screen code stays.

import type { Reading, Tile } from "../lib/step-screens";

export interface Paged {
  pane: HTMLElement;
  root: HTMLElement;
  list: HTMLElement;
  items: HTMLElement[];
}

/** The paged parts of a window, if it has any. */
export function pagedOf(pane: HTMLElement): Paged | undefined {
  const root = pane.querySelector<HTMLElement>("[data-paged-root]");
  const list = root?.querySelector<HTMLElement>("[data-paged]");
  if (!root || !list) return undefined;
  return { pane, root, list, items: [...list.children] as HTMLElement[] };
}

const px = (value: string): number => Number.parseFloat(value) || 0;

/**
 * Run `read` with `pane` put at `tile` (left, top, width, height in percent of
 * its area) unseen, then restore it: nothing is painted in between. The one
 * place a window is measured at a tile it is not on.
 */
export function placedAt<T>(
  pane: HTMLElement,
  tile: Tile,
  read: () => T,
): T {
  const style = pane.style.cssText;
  const [left, top, width, height] = tile;
  Object.assign(pane.style, {
    display: "block",
    visibility: "hidden",
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  });
  try {
    return read();
  } finally {
    pane.style.cssText = style;
  }
}

/**
 * The window's entries' heights, and the room a page has, when the window has
 * `tile`. The entries are shown for the reading, then put back.
 */
export function readWindow(
  { pane, root, list, items }: Paged,
  tile: Tile,
): Reading {
  return placedAt(pane, tile, () => {
    const hidden = items.map((i) => i.hidden);
    for (const i of items) i.hidden = false;
    try {
      const heights = items.map((i) =>
        Math.ceil(i.getBoundingClientRect().height),
      );
      // a list with nothing laid out (education's roles, closed) is one page
      if (heights.every((h) => h === 0))
        return { heights, room: Number.POSITIVE_INFINITY };
      const room = getComputedStyle(root);
      const budget =
        root.clientHeight - px(room.paddingTop) - px(room.paddingBottom);
      // what is above the list, and what the list adds around its entries
      const above =
        list.getBoundingClientRect().top -
        root.getBoundingClientRect().top -
        px(room.paddingTop);
      const around = Math.max(
        0,
        list.getBoundingClientRect().height -
          heights.reduce((a, h) => a + h, 0),
      );
      // a 2px margin for rounding
      return { heights, room: Math.floor(budget - above - around) - 2 };
    } finally {
      for (const [n, i] of items.entries()) i.hidden = hidden[n] ?? false;
    }
  });
}

/** Show only the entries at `indices`; `undefined` shows them all (a wide screen). */
export function showPage(
  { items }: Paged,
  indices: readonly number[] | undefined,
): void {
  for (const [n, i] of items.entries())
    i.hidden = indices ? !indices.includes(n) : false;
}
