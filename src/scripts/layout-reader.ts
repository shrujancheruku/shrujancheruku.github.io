// The page, read for src/lib/step-screens.ts: a window at a tile gives its
// entries' heights and its room; the timeline gives its limit; the archive
// gives an entry's index. Everything else about screens is that module's.
import type { StepScreensReader } from "../lib/step-screens";
import { type Paged, pagedOf, readWindow } from "./paged";
import { measureTimeline, openTo } from "./timeline-entries";

/** The paged parts of a window among `windows`, by its id, found once. */
export function pagedWindows(
  windows: ReadonlyMap<string, HTMLElement>,
): (id: string) => Paged | undefined {
  const found = new Map<string, Paged | undefined>();
  return (id) => {
    if (!found.has(id)) {
      const pane = windows.get(id);
      found.set(id, pane && pagedOf(pane));
    }
    return found.get(id);
  };
}

/** A reader over the windows, through their paged parts (`pagedWindows`). */
export function layoutReader(
  pagedWindow: (id: string) => Paged | undefined,
): StepScreensReader {
  return {
    window: (id, tile) => {
      const paged = pagedWindow(id);
      return paged && readWindow(paged, tile);
    },
    timeline: measureTimeline,
    limitTo: openTo,
    entryIndex: (slug) =>
      pagedWindow("archive")?.items.findIndex(
        (li) => li.dataset.entry?.toLowerCase() === slug.toLowerCase(),
      ) ?? -1,
  };
}
