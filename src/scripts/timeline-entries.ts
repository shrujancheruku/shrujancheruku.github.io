// The timeline's open entries on a phone (#130): they start open, up to a limit
// measured from the layout, and past the limit opening one closes the one
// open longest. The queue rules are src/lib/open-queue.ts; this reads the
// layout, keeps the markup true to the queue, and takes the taps.
import { initialQueue, toggled, trimmed } from "../lib/open-queue";
import type { Tile, TimelineProbe } from "../lib/step-screens";
import { placedAt } from "./paged";

const list = document.querySelector<HTMLElement>("[data-entries]");
const pane = list?.closest<HTMLElement>(".pane") ?? null;
const body = pane?.querySelector<HTMLElement>(".body") ?? null;
const articles = list
  ? [...list.querySelectorAll<HTMLElement>(".te.collapsible")]
  : [];
const buttons = articles.map((a) => a.querySelector<HTMLButtonElement>(".tgl"));

/** Open entries, longest-open first. */
let queue: number[] = [];
/** The most entries that fit open together; unmeasured until the first fit. */
let limit = Number.POSITIVE_INFINITY;
/** Whether the visitor has opened or closed one: after that the start state is theirs. */
let touched = false;

/** Make the markup say what `open` says. */
function render(open: readonly number[]): void {
  list?.toggleAttribute("data-has-open", open.length > 0);
  for (const [i, article] of articles.entries()) {
    const on = open.includes(i);
    article.setAttribute("data-open", String(on));
    buttons[i]?.setAttribute("aria-expanded", String(on));
  }
}

/** Whether the window's content is taller than its box. */
const overflows = (): boolean =>
  !!body && body.scrollHeight > body.clientHeight + 1;

/**
 * Run `find` on the timeline window at `tile`: it is given the entries and
 * whether the tallest `n` fit open together (the tallest are the ones tried,
 * so the limit holds whichever are opened), and its answer is the limit.
 * Undefined when the page has no timeline.
 */
export function measureTimeline(
  tile: Tile,
  find: (probe: TimelineProbe) => number,
): number | undefined {
  if (!pane || !list || !body || articles.length === 0) return undefined;
  const el = list;
  return placedAt(pane, tile, () => {
    try {
      // what each entry adds when it alone is open
      render([]);
      el.setAttribute("data-has-open", "");
      const base = el.getBoundingClientRect().height;
      const added = articles.map((_, i) => {
        render([i]);
        return el.getBoundingClientRect().height - base;
      });
      const tallest = added
        .map((h, i) => ({ h, i }))
        .sort((a, b) => b.h - a.h)
        .map((e) => e.i);
      return find({
        count: articles.length,
        fits: (n) => {
          render(tallest.slice(0, n));
          return !overflows();
        },
      });
    } finally {
      render(queue);
    }
  });
}

/**
 * Bring the open entries to `limit`: untouched they are the top ones up to
 * the limit, touched they are cut to it (the longest-open closing first).
 */
export function openTo(newLimit: number): void {
  if (articles.length === 0) return;
  limit = newLimit;
  queue = touched
    ? trimmed(queue, limit)
    : initialQueue(articles.length, limit);
  list?.setAttribute("data-limit", String(limit));
  render(queue);
}

list?.addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>(".tgl");
  const at = button ? buttons.indexOf(button) : -1;
  if (at < 0) return;
  touched = true;
  queue = toggled(queue, at, limit);
  render(queue);
});
