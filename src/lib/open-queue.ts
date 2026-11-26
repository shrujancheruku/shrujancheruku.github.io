// The timeline's open entries on a phone: a FIFO queue under a limit. Pure, no
// DOM. The queue holds entry indices, longest-open first. Opening a closed
// entry when the limit is reached closes the longest-open one; closing an
// entry by hand frees a slot.

/** The first `limit` of `count` entries, top to bottom: the start state. */
export function initialQueue(count: number, limit: number): number[] {
  return Array.from(
    { length: Math.max(0, Math.min(count, limit)) },
    (_, i) => i,
  );
}

/** The queue after `entry` is tapped: closed if open, else opened (evicting the oldest at the limit). */
export function toggled(
  queue: readonly number[],
  entry: number,
  limit: number,
): number[] {
  if (queue.includes(entry)) return queue.filter((e) => e !== entry);
  return trimmed([...queue, entry], limit);
}

/** The queue cut to `limit`, closing the longest-open first. */
export function trimmed(queue: readonly number[], limit: number): number[] {
  return queue.slice(Math.max(0, queue.length - Math.max(0, limit)));
}

/**
 * The most entries that can be open together: the largest `n` in 0..`count`
 * for which `fits(n)` (the top `n` open) holds. Opening more only takes room,
 * so the search stops at the first that fits counting down.
 */
export function limitOf(
  count: number,
  fits: (open: number) => boolean,
): number {
  for (let n = count; n > 0; n--) if (fits(n)) return n;
  return 0;
}
