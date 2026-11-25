import { describe, expect, test } from "bun:test";
import { createWheelGate, type WheelGate } from "../src/lib/wheel-gate";

const gate = () =>
  createWheelGate({ tailMs: 500, steadyMs: 150, threshold: 40 });

/** The e2e tests' flick: 120 decaying by 0.8 to 5. */
const FLICK: number[] = [];
for (let d = 120; d > 4; d = Math.floor(d * 0.8)) FLICK.push(d);

/** A flick starting at `start`, its events `gap` ms apart, as [time, delta]. */
const flickAt = (start: number, gap: number, sign = 1): [number, number][] =>
  FLICK.map((d, i) => [start + i * gap, sign * d]);

/**
 * Drive the gate as desktop.ts does: every step, fed or released, starts a
 * re-tile that holds the gate for `retile` ms; at its end the gate is released
 * and a pending step, if any, fires. Returns when each step fired.
 */
function drive(
  g: WheelGate,
  events: [number, number][],
  retile = 900,
): number[] {
  const fired: number[] = [];
  let releaseAt = Number.POSITIVE_INFINITY;
  const step = (time: number) => {
    fired.push(time);
    g.hold();
    releaseAt = time + retile;
  };
  const releaseUntil = (time: number) => {
    while (releaseAt <= time && releaseAt < Number.POSITIVE_INFINITY) {
      const at = releaseAt;
      releaseAt = Number.POSITIVE_INFINITY;
      if (g.release()) step(at);
    }
  };
  for (const [time, delta] of events) {
    releaseUntil(time);
    if (g.feed(time, delta)) step(time);
  }
  releaseUntil(Number.POSITIVE_INFINITY);
  return fired;
}

describe("the wheel gate", () => {
  test("a notch of wheel past the threshold moves one step", () => {
    expect(gate().feed(0, 100)).toBe(1);
    expect(gate().feed(0, -100)).toBe(-1);
  });

  test("small deltas add up to a step", () => {
    const g = gate();
    expect(g.feed(0, 15)).toBe(0);
    expect(g.feed(10, 15)).toBe(0);
    expect(g.feed(20, 15)).toBe(1);
  });

  test("a trackpad flick and its long inertia tail move exactly one step", () => {
    // 2.4 s of events, 16 ms apart, decaying from 120 to a run of 1s
    const events: [number, number][] = [];
    for (let t = 0; t < 2400; t += 16)
      events.push([t, Math.max(1, Math.round(120 * 0.97 ** (t / 16)))]);
    expect(drive(gate(), events)).toEqual([0]);
  });

  for (const gap of [16, 130, 200, 260, 400, 480]) {
    test(`a flick whose tail events come ${gap} ms apart is one step`, () => {
      expect(drive(gate(), flickAt(0, gap))).toEqual([0]);
    });
  }

  test("a slow tail is one step even with no re-tile holding the gate", () => {
    const g = gate();
    const steps = flickAt(0, 260).filter(([t, d]) => g.feed(t, d)).length;
    expect(steps).toBe(1);
  });

  test("a flick whose re-tile starts late is one step, its tail swallowed until the re-tile ends", () => {
    // captured in Chrome at 12x CPU throttle: the step at 10584 asked for a
    // re-tile that only ended at 11895, and the page was too busy to deliver
    // the tail for over a second
    const trace: [number, number][] = [
      [10584, 120],
      [11666, 30],
      [11739, 24],
      [11837, 19],
      [11930, 15],
      [11975, 12],
      [12020, 9],
      [12065, 7],
      [12110, 5],
    ];
    expect(drive(gate(), trace, 11895 - 10584)).toEqual([10584]);
  });

  describe("a flick whose events the browser coalesced", () => {
    // On a busy page Chromium merges queued wheel events into one and sums
    // their deltas, so a tail can rise once without being a new gesture.
    const coalesced = (merge: number): [number, number][] => {
      const deltas = [...FLICK];
      deltas.splice(merge, 2, (deltas[merge] ?? 0) + (deltas[merge + 1] ?? 0));
      return deltas.map((d, i) => [i * 33, d]);
    };

    test("is one step when a late pair is merged (15 + 12 after 19)", () => {
      const merge = FLICK.indexOf(15);
      expect(coalesced(merge)[merge]?.[1]).toBe(27);
      expect(drive(gate(), coalesced(merge))).toEqual([0]);
    });

    test("is one step when an early pair is merged (60 + 48 after 76)", () => {
      const merge = FLICK.indexOf(60);
      expect(coalesced(merge)[merge]?.[1]).toBe(108);
      expect(drive(gate(), coalesced(merge))).toEqual([0]);
    });

    test("is one step with no re-tile holding the gate", () => {
      const g = gate();
      const merge = FLICK.indexOf(15);
      const steps = coalesced(merge).filter(([t, d]) => g.feed(t, d)).length;
      expect(steps).toBe(1);
    });
  });

  test("a new flick out of a decayed tail still steps", () => {
    // the tail has decayed to 20 when a new flick starts at 60
    const events: [number, number][] = [
      [0, 120],
      [40, 60],
      [80, 30],
      [120, 20],
      [1000, 60],
    ];
    expect(drive(gate(), events)).toEqual([0, 1000]);
  });

  test("a flick with a long tail through the whole re-tile is one step", () => {
    // 60 ms apart, so the tail runs on for 780 ms of the 900 ms re-tile
    expect(drive(gate(), flickAt(0, 60))).toEqual([0]);
  });

  describe("equal mouse notches", () => {
    test("700 ms apart, three notches are three steps", () => {
      const notches: [number, number][] = [
        [0, 120],
        [700, 120],
        [1400, 120],
      ];
      // the second waits for the first re-tile, the third for the second
      expect(drive(gate(), notches)).toEqual([0, 900, 1800]);
    });

    test("300 then 700 ms apart, three notches are three steps", () => {
      const notches: [number, number][] = [
        [0, 120],
        [300, 120],
        [1000, 120],
      ];
      expect(drive(gate(), notches)).toEqual([0, 900, 1800]);
    });

    test("a settle apart, each notch steps at once", () => {
      const notches: [number, number][] = [0, 1, 2, 3].map((i) => [
        i * 1100,
        -120,
      ]);
      expect(drive(gate(), notches)).toEqual([0, 1100, 2200, 3300]);
    });

    test("in one quick spin, notches are one gesture", () => {
      const spin: [number, number][] = [0, 40, 80, 120].map((t) => [t, 120]);
      expect(drive(gate(), spin)).toEqual([0]);
    });
  });

  describe("a step asked for during a re-tile", () => {
    test("waits, and fires as soon as the re-tile releases", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.hold();
      expect(g.feed(600, 120)).toBe(0);
      expect(g.release()).toBe(1);
    });

    test("is never more than one", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.hold();
      expect(g.feed(300, 120)).toBe(0);
      expect(g.feed(600, 120)).toBe(0);
      expect(g.feed(800, 120)).toBe(0);
      expect(g.release()).toBe(1);
      // nothing more was queued
      g.hold();
      expect(g.release()).toBe(0);
    });

    test("is not queued by the first flick's own tail", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.hold();
      for (const [t, d] of flickAt(0, 50).slice(1))
        expect(g.feed(t, d)).toBe(0);
      expect(g.release()).toBe(0);
    });

    test("goes the way of the latest gesture", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.hold();
      expect(g.feed(400, 120)).toBe(0);
      expect(g.feed(700, -120)).toBe(0);
      expect(g.release()).toBe(-1);
    });

    test("a second flick during the re-tile steps the moment it ends", () => {
      const events = [...flickAt(0, 30), ...flickAt(700, 30)];
      expect(drive(gate(), events)).toEqual([0, 900]);
    });
  });

  test("a second flick after a pause steps on its first event", () => {
    const events = [...flickAt(0, 260), ...flickAt(3380 + 1100, 50)];
    expect(drive(gate(), events)).toEqual([0, 4480]);
  });

  test("a second flick hard on the tail steps on its first event, because it rises", () => {
    const events = [...flickAt(0, 40), ...flickAt(960, 40)];
    expect(drive(gate(), events)).toEqual([0, 960]);
  });

  test("eight flicks a settle apart are eight steps", () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      flickAt(i * 1800, 50),
    ).flat();
    expect(drive(gate(), events)).toHaveLength(8);
  });

  test("a scroll the other way after a pause goes back", () => {
    expect(
      drive(gate(), [
        [0, 100],
        [1500, -100],
      ]),
    ).toEqual([0, 1500]);
  });

  test("a smaller push after a long pause is a new gesture", () => {
    expect(
      drive(gate(), [
        [0, 100],
        [3000, 50],
      ]),
    ).toEqual([0, 3000]);
  });

  test("events with no vertical delta neither step nor break a tail", () => {
    const g = gate();
    expect(g.feed(0, 100)).toBe(1);
    g.hold();
    expect(g.feed(300, 30)).toBe(0);
    expect(g.feed(350, 0)).toBe(0);
    expect(g.feed(400, 25)).toBe(0);
    expect(g.release()).toBe(0);
    expect(g.feed(450, 20)).toBe(0);
  });
});
