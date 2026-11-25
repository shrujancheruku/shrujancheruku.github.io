// Turns a stream of wheel deltas into at most one step per gesture.
//
// A trackpad flick keeps sending events for a second or more after the
// fingers lift, and on a busy page those events can arrive hundreds of ms
// apart. A gap alone cannot tell such a tail from a new gesture, but its
// magnitude can: a tail only decays. So after a step, an event is the tail
// while it comes the same way as the one before, no larger, and within
// `tailMs` of it. A delta that rises again, turns round, or comes after a
// longer silence is a new gesture.
//
// A mouse wheel sends equal notches, each a gesture of its own. Equal deltas
// are tail only when they come close together, as momentum does; an equal
// delta big enough to step on its own, `steadyMs` or more after the last, is
// a new notch.
//
// The caller holds the gate for the real re-tile, which on a busy page can
// start late and end well after the event that asked for it, and releases it
// when that ends. While held, a shrinking delta is tail however long the page
// kept it waiting. A new gesture that comes while held is not dropped: the
// gate remembers one pending step, the latest gesture's way, and `release`
// hands it back to be taken at once.

export interface WheelGateOptions {
  /** The longest gap between two events of one gesture's tail, in ms. */
  tailMs: number;
  /** The shortest gap at which an equal, step-sized delta is a new notch, in ms. */
  steadyMs: number;
  /** How much delta, summed, makes a step. */
  threshold: number;
}

export interface WheelGate {
  /** Feed one wheel event; returns the step to take now: 1, -1 or 0. */
  feed(time: number, delta: number): 1 | -1 | 0;
  /** Keep the gate shut until `release`, however long that takes. */
  hold(): void;
  /** The re-tile ended: open the gate, and return the step that waited for it. */
  release(): 1 | -1 | 0;
}

export function createWheelGate({
  tailMs,
  steadyMs,
  threshold,
}: WheelGateOptions): WheelGate {
  let held = false;
  /** A step asked for while held: at most one, taken at the release. */
  let pending: 1 | -1 | 0 = 0;
  /** After a step, until a new gesture starts: the events are its tail. */
  let inTail = false;
  let last = Number.NEGATIVE_INFINITY;
  let previous = 0;
  let sum = 0;

  const isTail = (gap: number, delta: number, before: number): boolean => {
    if (Math.sign(delta) !== Math.sign(before)) return false;
    const size = Math.abs(delta);
    const was = Math.abs(before);
    if (size > was) return false;
    if (size === was && gap >= steadyMs && size >= threshold) return false;
    return gap < tailMs || held;
  };

  return {
    feed(time, delta) {
      // horizontal-only events carry no vertical delta: they are not ours
      if (delta === 0) return 0;
      const gap = time - last;
      const before = previous;
      last = time;
      previous = delta;

      if (inTail) {
        if (isTail(gap, delta, before)) return 0;
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
      if (!held) return direction;
      pending = direction;
      return 0;
    },
    hold() {
      held = true;
    },
    release() {
      if (!held) return 0;
      held = false;
      const step = pending;
      pending = 0;
      return step;
    },
  };
}
