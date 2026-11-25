import { describe, expect, test } from "bun:test";
import { createWheelGate } from "../src/lib/wheel-gate";

const gate = () => createWheelGate({ lockMs: 900, tailMs: 500, threshold: 40 });

/** The e2e tests' flick: 120 decaying by 0.8 to 5, `gap` ms apart. */
const FLICK: number[] = [];
for (let d = 120; d > 4; d = Math.floor(d * 0.8)) FLICK.push(d);

/**
 * Feed a flick starting at `start` as desktop.ts does: a step holds the gate
 * for a re-tile that ends `retile` ms later. Returns the steps and the time of
 * the flick's last event.
 */
function flick(
  g: ReturnType<typeof gate>,
  start: number,
  gap: number,
  retile = 900,
): { steps: number; end: number } {
  let steps = 0;
  let releaseAt = Number.POSITIVE_INFINITY;
  let t = start;
  for (const d of FLICK) {
    if (t >= releaseAt) {
      g.release();
      releaseAt = Number.POSITIVE_INFINITY;
    }
    const step = g.feed(t, d);
    if (step) {
      g.hold();
      releaseAt = t + retile;
    }
    steps += Math.abs(step);
    t += gap;
  }
  if (releaseAt < Number.POSITIVE_INFINITY) g.release();
  return { steps, end: t - gap };
}

describe("the wheel gate", () => {
  test("a notch of wheel past the threshold moves one step", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    const h = gate();
    expect(h.feed(0, -100)).toBe(-1);
  });

  test("small deltas add up to a step", () => {
    const g = gate();
    expect(g.feed(0, 15)).toBe(0);
    expect(g.feed(10, 15)).toBe(0);
    expect(g.feed(20, 15)).toBe(1);
  });

  test("a trackpad flick and its long inertia tail move exactly one step", () => {
    const g = gate();
    let steps = 0;
    // 2.4 s of events, 16 ms apart, decaying from 120 to 1.
    for (let t = 0; t < 2400; t += 16) {
      steps += Math.abs(g.feed(t, Math.max(1, 120 * 0.97 ** (t / 16))));
    }
    expect(steps).toBe(1);
  });

  test("a new gesture after a pause moves another step", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(2000, 100)).toBe(1);
  });

  test("a gesture started during the animation is swallowed", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(500, -100)).toBe(0);
  });

  test("a scroll in the other direction, after the lock and a pause, goes back", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(1500, -100)).toBe(-1);
  });

  test("a flick whose re-tile starts late is one step, its tail swallowed until the re-tile ends", () => {
    // captured in Chrome at 12x CPU throttle: the step at 10584 asked for a
    // re-tile that only started at 11152 and ended at 11895, so the 850 ms
    // lock ran out mid-animation and the tail at 11739 stepped again
    const g = gate();
    const trace: [number, number][] = [
      [10584, 120],
      [11666, 30],
      [11739, 24],
      [11837, 19],
      // the re-tile ends at 11895; the tail runs on
      [11930, 15],
      [11975, 12],
      [12020, 9],
      [12065, 7],
      [12110, 5],
    ];
    let steps = 0;
    let released = false;
    for (const [t, d] of trace) {
      if (!released && t > 11895) {
        g.release();
        released = true;
      }
      const step = g.feed(t, d);
      if (step) g.hold(); // as desktop.ts does: a step starts a re-tile
      steps += Math.abs(step);
    }
    expect(steps).toBe(1);
    // and the next flick, after a pause, steps again
    expect(g.feed(13000, 120)).toBe(1);
  });

  test("a flick whose tail events come further apart than the quiet gap is one step", () => {
    // a loaded browser delivering the tail 130 ms apart
    const g = gate();
    let steps = 0;
    let t = 0;
    for (let d = 120; d > 4; d = Math.floor(d * 0.8), t += 130) {
      steps += Math.abs(g.feed(t, d));
    }
    expect(steps).toBe(1);
  });

  test("a smaller push after a long pause is a new gesture", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(3000, 50)).toBe(1);
  });

  test("while held for a running re-tile the gate stays shut, and the tail runs on after the release", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    g.hold();
    expect(g.feed(1200, 30)).toBe(0);
    expect(g.feed(1500, 25)).toBe(0);
    g.release();
    // no larger than the last event, within the tail window: tail
    expect(g.feed(1650, 20)).toBe(0);
    // rising again: a new gesture
    expect(g.feed(1700, 120)).toBe(1);
  });

  test("single mouse notches a settle apart each step, though each is as big as the last", () => {
    const g = gate();
    let steps = 0;
    for (let i = 0; i < 8; i++) {
      const t = i * 1100;
      const step = g.feed(t, -120);
      if (step) g.hold();
      steps += Math.abs(step);
      g.release();
    }
    expect(steps).toBe(8);
  });

  for (const gap of [16, 130, 200, 260, 400, 480]) {
    test(`a flick whose tail events come ${gap} ms apart is one step`, () => {
      expect(flick(gate(), 0, gap).steps).toBe(1);
    });
  }

  test("a slow tail without a re-tile hold is still one step", () => {
    const g = gate();
    let steps = 0;
    FLICK.forEach((d, i) => {
      steps += Math.abs(g.feed(i * 260, d));
    });
    expect(steps).toBe(1);
  });

  test("a second flick after a pause steps again, on its first event", () => {
    const g = gate();
    const first = flick(g, 0, 260);
    expect(first.steps).toBe(1);
    expect(g.feed(first.end + 1100, 120)).toBe(1);
  });

  test("a second flick hard on the tail steps on its first event, because it rises", () => {
    const g = gate();
    const first = flick(g, 0, 40);
    expect(first.steps).toBe(1);
    // the re-tile ended at 900; the tail ended earlier; a new flick 60 ms later
    expect(g.feed(960, 120)).toBe(1);
  });

  test("eight flicks a settle apart are eight steps", () => {
    const g = gate();
    let t = 0;
    let steps = 0;
    for (let i = 0; i < 8; i++) {
      const f = flick(g, t, 50);
      steps += f.steps;
      t = f.end + 1100;
    }
    expect(steps).toBe(8);
  });

  test("events with no vertical delta neither step nor break a tail", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(500, 30)).toBe(0); // locked
    expect(g.feed(950, 25)).toBe(0); // tail
    expect(g.feed(1000, 0)).toBe(0); // horizontal only
    expect(g.feed(1050, 20)).toBe(0); // still tail: 20 is no larger than 25
    expect(g.feed(1100, 15)).toBe(0);
  });
});
