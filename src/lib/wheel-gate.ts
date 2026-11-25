// Turns a stream of wheel deltas into at most one step per gesture.
//
// A trackpad flick keeps sending events for a second or more after the
// fingers lift. After a step the gate stays shut while the animation runs,
// then until the wheel has been quiet for `quietMs`, so that tail never
// becomes a second step.
//
// `lockMs` counts from the wheel event, but on a busy page the re-tile can
// start late and end well after it, while the tail is still arriving. So the
// caller holds the gate for the real animation and releases it when that ends;
// the quiet then counts from the release.

export interface WheelGateOptions {
  /** How long the gate stays shut after a step, in ms (the animation). */
  lockMs: number;
  /** How long the wheel must be silent after that before it opens again. */
  quietMs: number;
  /** How much delta, summed, makes a step. */
  threshold: number;
}

export interface WheelGate {
  /** Feed one wheel event; returns the step to take: 1, -1 or 0. */
  feed(time: number, delta: number): 1 | -1 | 0;
  /** Keep the gate shut until `release`, however long that takes. */
  hold(): void;
  /** The animation ended at `time`; open after `quietMs` of silence from then. */
  release(time: number): void;
}

export function createWheelGate({
  lockMs,
  quietMs,
  threshold,
}: WheelGateOptions): WheelGate {
  let lockedUntil = Number.NEGATIVE_INFINITY;
  let needQuiet = false;
  let held = false;
  let last = Number.NEGATIVE_INFINITY;
  let sum = 0;

  return {
    feed(time, delta) {
      const gap = time - last;
      last = time;

      if (held || time < lockedUntil) return 0;
      if (needQuiet) {
        if (gap < quietMs) return 0;
        needQuiet = false;
      }

      // A pause or a change of direction starts a new gesture.
      if (gap >= quietMs || Math.sign(delta) !== Math.sign(sum)) sum = 0;
      sum += delta;
      if (Math.abs(sum) < threshold) return 0;

      const direction = sum > 0 ? 1 : -1;
      sum = 0;
      lockedUntil = time + lockMs;
      needQuiet = true;
      return direction;
    },
    hold() {
      held = true;
    },
    release(time) {
      if (!held) return;
      held = false;
      needQuiet = true;
      last = Math.max(last, time);
    },
  };
}
