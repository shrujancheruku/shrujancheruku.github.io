// A step's screens on a phone, now. Pure, no DOM: what is on the page comes in
// through a reader, and this module decides what fits, keeps what it read
// until `changed` says what fits is not what it was, and finds the same entry
// again afterwards.
//
// What it hides, so no caller has to remember it: the timeline's open limit is
// fitted before any step's screens are counted; readings are kept per window
// and tile, and dropped together; the screen on show is found again by its
// first entry. src/scripts/layout-reader.ts is the reader over the page.
import type { Where } from "./navigator";
import { limitOf } from "./open-queue";
import {
  anchorOf,
  type EntriesOf,
  expandScreens,
  paginate,
  type Screen,
  screenHolding,
} from "./screens";
import type { Layout } from "./workspaces";

export type Tile = Layout[string];

/** A paged window at a tile: its entries' heights in order, and the room a page has. */
export interface Reading {
  heights: readonly number[];
  room: number;
}

/** What the timeline offers a search for its limit: its entries, and whether the top `open` fit together. */
export interface TimelineProbe {
  count: number;
  fits: (open: number) => boolean;
}

/** Reads the page. Each reading is of a window at a tile, put there unseen and restored. */
export interface StepScreensReader {
  /** The window's entries and room at `tile`; undefined if the window does not page. */
  window(id: string, tile: Tile): Reading | undefined;
  /** Run `find` on the timeline at `tile` and give back its answer; undefined if there is no timeline. */
  timeline(
    tile: Tile,
    find: (probe: TimelineProbe) => number,
  ): number | undefined;
  /** Bring the timeline's open entries to `limit`. */
  limitTo(limit: number): void;
  /** The archive entry's index among its entries; -1 if there is none. */
  entryIndex(slug: string): number;
}

export interface StepScreensConfig {
  steps: number;
  /** Whether the screen is a phone's now. */
  touch: () => boolean;
  /** Step `n`'s layouts on a phone, one after another. */
  layouts: (n: number, opened: boolean) => readonly Layout[];
  /** Step `n`'s one tiling on a wide screen. */
  wide: (n: number, opened: boolean) => Layout;
  reader: StepScreensReader;
}

export interface StepScreens {
  /** The screens of step `n`; `opened` says whether its disclosure is open. */
  screens(n: number, opened: boolean): Screen[];
  /** The entries a paged window shows on a screen (all of them wide: none given). */
  entriesOf: EntriesOf;
  /** The pages a paged window falls into at a tile. */
  pagesOf(id: string, tile: Tile): number[][];
  /** The screen of step `n`'s archive holding an entry (0 on a wide screen). */
  screenOfEntry(n: number, slug: string): number;
  /**
   * What fits has changed (resize, fonts, the disclosure, wide <-> touch).
   * Given where the visitor is on a phone, gives the screen that now holds
   * what was first on show there.
   */
  changed(at?: Where): number | undefined;
}

export function createStepScreens(config: StepScreensConfig): StepScreens {
  const { reader } = config;
  /** Pages by window and tile; null where the window does not page. */
  const cache = new Map<string, number[][] | null>();
  let timelineFitted = false;

  function readPages(id: string, tile: Tile): number[][] | null {
    const key = `${id}:${tile.join(",")}`;
    let found = cache.get(key);
    if (found === undefined) {
      const reading = reader.window(id, tile);
      found = reading ? paginate(reading.heights, reading.room) : null;
      cache.set(key, found);
    }
    return found;
  }

  const pagesOf = (id: string, tile: Tile): number[][] =>
    readPages(id, tile) ?? [[]];

  /** The timeline's limit, measured and applied, once per change. */
  function fitTimeline(): void {
    if (timelineFitted) return;
    timelineFitted = true;
    for (let n = 0; n < config.steps; n++) {
      const tile = config.layouts(n, false)[0]?.timeline;
      if (!tile) continue;
      const limit = reader.timeline(tile, ({ count, fits }) =>
        limitOf(count, fits),
      );
      if (limit !== undefined) reader.limitTo(limit);
      return;
    }
  }

  function screens(n: number, opened: boolean): Screen[] {
    // the stack's height is in px: the wide tiling reads the live area (#160)
    if (!config.touch()) return [{ layout: config.wide(n, opened), pages: {} }];
    // the limit comes first: the timeline is always the one screen
    fitTimeline();
    const layouts = config.layouts(n, opened);
    const counts: Record<string, number> = {};
    for (const layout of layouts)
      for (const [id, tile] of Object.entries(layout)) {
        const found = readPages(id, tile);
        if (found) counts[id] = found.length;
      }
    return expandScreens(layouts, counts);
  }

  const entriesOf: EntriesOf = (screen, id) => {
    const tile = screen.layout[id];
    return tile ? (pagesOf(id, tile)[screen.pages[id] ?? 0] ?? []) : [];
  };

  function screenOfEntry(n: number, slug: string): number {
    if (!config.touch() || !slug) return 0;
    const tile = config.layouts(n, true)[0]?.archive;
    const at = reader.entryIndex(slug);
    if (at < 0 || !tile) return 0;
    return Math.max(
      0,
      pagesOf("archive", tile).findIndex((ix) => ix.includes(at)),
    );
  }

  function changed(at?: Where): number | undefined {
    timelineFitted = false;
    if (!at || !config.touch()) {
      cache.clear();
      return undefined;
    }
    // the limit is fitted first; the anchor is read from the pages as they were
    fitTimeline();
    const before = screens(at.step, at.open)[at.screen];
    const anchor = before && anchorOf(before, entriesOf);
    cache.clear();
    return anchor
      ? screenHolding(screens(at.step, at.open), anchor, entriesOf)
      : undefined;
  }

  return { screens, entriesOf, pagesOf, screenOfEntry, changed };
}
