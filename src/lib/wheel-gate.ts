// Turns a stream of wheel deltas into at most one step per gesture.
//
// A trackpad flick keeps sending events for a second or more after the
// fingers lift, and on a busy page those events can arrive hundreds of ms
// apart. A gap alone cannot tell such a tail from a new gesture, but its
// magnitude can: a tail decays. So after a step, an event is the tail while
// it comes the same way as the one before, does not rise past it, and comes
// within `tailMs` of it. A delta that turns round, comes after a longer
// silence, or rises (more than doubles, is big enough to step, and is more
// per event than the one before) is a new gesture.
//
// On a busy page Chromium coalesces queued wheel events into one: it sums
// their deltas and keeps the latest one's time. Events queue only while the
// page is busy, so the caller says how long it was (`stall`, the longest
// stretch without a frame since the event before), and an event that comes
// after such a stall, where the events had been coming `cadence` apart,
// stands for about stall / cadence of them: a tail's merged sum can be
// several times the event before. Per event it still does not rise, and a
// new flick out of a decayed tail does. A silence with the page idle merges
// nothing, so a new flick after one is judged on its size alone.
//
// A mouse wheel sends equal notches, each a gesture of its own. Equal deltas
// are tail only when they come close together, as momentum does; an equal
// delta big enough to step on its own, `steadyMs` or more after the last, is
// a new notch.
//
// The caller says when a step's motion runs (`moving`) and when it ends
// (`still`): on a busy page it can start late and end well after the event
// that asked for it. While it runs, a shrinking delta is tail however long the
// page kept it waiting. The gate is never shut, though: a new gesture during
// a motion steps at once, and the caller decides what that step does (turn
// the motion back, or wait for it to end).

export interface WheelGateOptions {
  /** The longest gap between two events of one gesture's tail, in ms. */
  tailMs: number;
  /** The shortest gap at which an equal, step-sized delta is a new notch, in ms. */
  steadyMs: number;
  /** How much delta, summed, makes a step. */
  threshold: number;
}

export interface WheelGate {
  /**
   * Feed one wheel event; returns the step to take now: 1, -1 or 0. `stall`
   * is the longest the page went without a frame since the event before, in
   * ms: how long events could have queued to be merged into this one.
   */
  feed(time: number, delta: number, stall?: number): 1 | -1 | 0;
  /**
   * Note a wheel event that something else used, such as a window scrolling
   * its own content. It never steps, but the rest of its gesture is tail, so
   * a flick that scrolls a window to its end does not carry on into a step.
   */
  absorb(time: number, delta: number): void;
  /** A step's motion is running: its gesture's tail stays tail until `still`. */
  moving(): void;
  /** The motion ended. */
  still(): void;
}

/**
 * The shortest cadence a gap is measured against, in ms: events closer
 * together than this (a burst, or a 240 Hz device) count as this far apart.
 */
const MIN_CADENCE_MS = 8;

export function createWheelGate({
  tailMs,
  steadyMs,
  threshold,
}: WheelGateOptions): WheelGate {
  /** A step's motion is running. */
  let held = false;
  /** After a step, until a new gesture starts: the events are its tail. */
  let inTail = false;
  let last = Number.NEGATIVE_INFINITY;
  let previous = 0;
  /**
   * The cadence the device sends at: the last gap shorter than `tailMs`,
   * kept across silences. Until one is seen, the shortest: a step's own
   * re-tile can merge the rest of its flick into the very next event.
   */
  let cadence = MIN_CADENCE_MS;
  let sum = 0;

  const isTail = (
    gap: number,
    delta: number,
    before: number,
    stall: number,
  ): boolean => {
    if (Math.sign(delta) !== Math.sign(before)) return false;
    const size = Math.abs(delta);
    const was = Math.abs(before);
    // how many events this one may be, coalesced while the page was busy: a
    // tail's merged sum can be many times the event before, but never more
    // per event
    const merged = Math.max(1, Math.min(gap, stall) / cadence);
    if (size > 2 * was && size >= threshold && size / merged > was)
      return false;
    if (size === was && gap >= steadyMs && size >= threshold) return false;
    return gap < tailMs || held;
  };

  /** Note an event's time and delta; returns its gap and the delta before. */
  const note = (time: number, delta: number) => {
    const gap = time - last;
    const before = previous;
    last = time;
    previous = delta;
    return { gap, before };
  };
  /** After an event is judged: its gap, if short, is the device's cadence. */
  const keep = (gap: number) => {
    if (gap < tailMs) cadence = Math.max(gap, MIN_CADENCE_MS);
  };

  return {
    feed(time, delta, stall = 0) {
      // horizontal-only events carry no vertical delta: they are not ours
      if (delta === 0) return 0;
      const { gap, before } = note(time, delta);
      const tail = inTail && isTail(gap, delta, before, stall);
      keep(gap);

      if (inTail) {
        if (tail) return 0;
        inTail = false;
        sum = 0;
      }

      // a pause or a change of direction starts a new gesture
      if (gap >= tailMs || Math.sign(delta) !== Math.sign(sum)) sum = 0;
      sum += delta;
      if (Math.abs(sum) < threshold) return 0;

      const direction = sum > 0 ? 1 : -1;
      sum = 0;
      inTail = true;
      return direction;
    },
    absorb(time, delta) {
      if (delta === 0) return;
      keep(note(time, delta).gap);
      sum = 0;
      inTail = true;
    },
    moving() {
      held = true;
    },
    still() {
      held = false;
    },
  };
}
