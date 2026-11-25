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
});
