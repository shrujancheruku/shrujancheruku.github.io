// The page, read for src/lib/step-screens.ts: a window at a tile gives its
// entries' heights and its room; the timeline gives its limit; the archive
// gives an entry's index. Everything else about screens is that module's.
import type { StepScreensReader } from "../lib/step-screens";
import { type Paged, pagedOf, readWindow } from "./paged";
import { measureTimeline, openTo } from "./timeline-entries";

/** A reader over the windows `panes`, by their `data-window`. */
export function layoutReader(panes: readonly HTMLElement[]): StepScreensReader {
  const windowOf = new Map(panes.map((p) => [p.dataset.window ?? "", p]));
  const found = new Map<string, Paged | undefined>();
  const pagedWindow = (id: string): Paged | undefined => {
    if (!found.has(id)) {
      const pane = windowOf.get(id);
      found.set(id, pane && pagedOf(pane));
    }
    return found.get(id);
  };
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
