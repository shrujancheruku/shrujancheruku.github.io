// Turns a stream of wheel deltas into at most one step per gesture.
//
// A trackpad flick keeps sending events for a second or more after the
// fingers lift, and on a busy page those events can arrive hundreds of ms
// apart. A gap alone cannot tell such a tail from a new gesture, but its
// magnitude can: a tail only decays. So after a step the gate stays shut
// while the animation runs, then for as long as each event comes within
// `tailMs` of the one before, the same way, and no larger. A delta that rises
// again, turns round, or comes after a longer silence is a new gesture.
//
// `lockMs` counts from the wheel event, but on a busy page the re-tile can
// start late and end well after it. So the caller also holds the gate for the
// real animation and releases it when that ends. The tail window still runs
// from the last wheel event, not the release: a single mouse notch has no
// tail, and the next notch a second later is a new gesture.

export interface WheelGateOptions {
  /** How long the gate stays shut after a step, in ms (the animation). */
  lockMs: number;
  /** The longest gap between two events of one gesture's tail, in ms. */
  tailMs: number;
  /** How much delta, summed, makes a step. */
  threshold: number;
}

export interface WheelGate {
  /** Feed one wheel event; returns the step to take: 1, -1 or 0. */
  feed(time: number, delta: number): 1 | -1 | 0;
  /** Keep the gate shut until `release`, however long that takes. */
  hold(): void;
  /** The animation ended: open the gate to anything but the tail. */
  release(): void;
}

export function createWheelGate({
  lockMs,
  tailMs,
  threshold,
}: WheelGateOptions): WheelGate {
  let lockedUntil = Number.NEGATIVE_INFINITY;
  let held = false;
  /** After a step, until a new gesture starts: the events are its tail. */
  let inTail = false;
  let last = Number.NEGATIVE_INFINITY;
  let previous = 0;
  let sum = 0;

  return {
    feed(time, delta) {
      // horizontal-only events carry no vertical delta: they are not ours
      if (delta === 0) return 0;
      const gap = time - last;
      const before = previous;
      last = time;
      previous = delta;

      if (held || time < lockedUntil) return 0;
      if (inTail) {
        const decaying =
          gap < tailMs &&
          Math.sign(delta) === Math.sign(before) &&
          Math.abs(delta) <= Math.abs(before);
        if (decaying) return 0;
        inTail = false;
        sum = 0;
      }

      // a pause or a change of direction starts a new gesture
      if (gap >= tailMs || Math.sign(delta) !== Math.sign(sum)) sum = 0;
      sum += delta;
      if (Math.abs(sum) < threshold) return 0;

      const direction = sum > 0 ? 1 : -1;
      sum = 0;
      lockedUntil = time + lockMs;
      inTail = true;
      return direction;
    },
    hold() {
      held = true;
    },
    release() {
      if (!held) return;
      held = false;
      inTail = true;
    },
  };
}
