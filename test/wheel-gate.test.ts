import { describe, expect, test } from "bun:test";
import { createWheelGate } from "../src/lib/wheel-gate";

const gate = () =>
  createWheelGate({ lockMs: 900, quietMs: 120, threshold: 40 });

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
        g.release(11895);
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

  test("while held for a running re-tile the gate stays shut, and quiet counts from the release", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    g.hold();
    expect(g.feed(2000, 100)).toBe(0);
    g.release(2500);
    expect(g.feed(2550, 100)).toBe(0);
    expect(g.feed(2800, 100)).toBe(1);
  });
});
