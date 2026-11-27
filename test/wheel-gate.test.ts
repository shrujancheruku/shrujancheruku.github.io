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

/** A wheel event: [time, delta], and how long the page was busy before it. */
type Wheel = [number, number] | [number, number, number];

/**
 * Drive the gate as desktop.ts does: every step starts a motion of `retile`
 * ms, which the gate is told of. A step the gate gives during a motion waits
 * (the latest only) and runs when the motion ends. Returns when each step ran.
 */
function drive(g: WheelGate, events: Wheel[], retile = 900): number[] {
  const fired: number[] = [];
  let endsAt = Number.POSITIVE_INFINITY;
  let waiting = false;
  const step = (time: number) => {
    fired.push(time);
    g.moving();
    endsAt = time + retile;
  };
  const endUntil = (time: number) => {
    while (endsAt <= time && endsAt < Number.POSITIVE_INFINITY) {
      const at = endsAt;
      endsAt = Number.POSITIVE_INFINITY;
      g.still();
      if (waiting) {
        waiting = false;
        step(at);
      }
    }
  };
  for (const [time, delta, stall] of events) {
    endUntil(time);
    if (!g.feed(time, delta, stall)) continue;
    if (endsAt < Number.POSITIVE_INFINITY) waiting = true;
    else step(time);
  }
  endUntil(Number.POSITIVE_INFINITY);
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

  test("a slow tail is one step even with no motion running", () => {
    const g = gate();
    const steps = flickAt(0, 260).filter(([t, d]) => g.feed(t, d)).length;
    expect(steps).toBe(1);
  });

  test("a flick whose re-tile starts late is one step, its tail swallowed until the motion ends", () => {
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
    // On a busy page Chromium merges queued wheel events into one: it sums
    // their deltas and keeps the latest one's time. So a tail can rise,
    // several times over, without being a new gesture. The page was busy
    // (no frame) from the event before until the merged one.
    const coalesced = (merge: number, count = 2, gap = 33): Wheel[] => {
      const events: Wheel[] = flickAt(0, gap);
      const merged = events.slice(merge, merge + count);
      const sum = merged.reduce((s, [, d]) => s + d, 0);
      const at = merged.at(-1)?.[0] ?? 0;
      const before = events[merge - 1]?.[0] ?? 0;
      events.splice(merge, count, [at, sum, at - before]);
      return events;
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

    test("is one step with no motion running", () => {
      const g = gate();
      const merge = FLICK.indexOf(15);
      const steps = coalesced(merge).filter(([t, d, b]) =>
        g.feed(t, d, b),
      ).length;
      expect(steps).toBe(1);
    });

    test("is one step when four are merged (48 + 38 + 30 + 24 after 60)", () => {
      const merge = FLICK.indexOf(48);
      expect(coalesced(merge, 4)[merge]?.[1]).toBe(140);
      expect(drive(gate(), coalesced(merge, 4))).toEqual([0]);
    });

    test("is one step when four are merged with no motion running", () => {
      const g = gate();
      const merge = FLICK.indexOf(48);
      const events = coalesced(merge, 4, 16);
      expect(events.filter(([t, d, b]) => g.feed(t, d, b)).length).toBe(1);
    });

    test("is one step when a slow frame merges most of the tail", () => {
      // 96 to 19 arrive as one event, after the step on 120
      const merge = FLICK.indexOf(96);
      const events = coalesced(merge, 8, 16);
      expect(events[merge]?.[1]).toBe(96 + 76 + 60 + 48 + 38 + 30 + 24 + 19);
      expect(drive(gate(), events)).toEqual([0]);
    });

    test("still lets a new flick out of a merged tail step", () => {
      const merge = FLICK.indexOf(48);
      const events = [...coalesced(merge, 4, 16), ...flickAt(400, 16)];
      expect(drive(gate(), events, 300)).toEqual([0, 400]);
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

  describe("a gesture during a motion", () => {
    test("steps at once: the gate is not held shut while the windows move", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.moving();
      expect(g.feed(600, 120)).toBe(1);
    });

    test("turning round steps the other way at once, to turn the motion back", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.moving();
      expect(g.feed(100, -120)).toBe(-1);
    });

    test("is not a step of the first flick's own tail", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.moving();
      for (const [t, d] of flickAt(0, 50).slice(1))
        expect(g.feed(t, d)).toBe(0);
    });

    test("a tail the busy page kept waiting stays tail while the windows move", () => {
      const g = gate();
      expect(g.feed(0, 120)).toBe(1);
      g.moving();
      expect(g.feed(900, 90)).toBe(0);
      expect(g.feed(1700, 60)).toBe(0);
      g.still();
      // at rest, a silence that long starts a new gesture
      expect(g.feed(2600, 60)).toBe(1);
    });

    test("a second flick during the motion steps the moment it ends", () => {
      const events = [...flickAt(0, 30), ...flickAt(700, 30)];
      expect(drive(gate(), events)).toEqual([0, 900]);
    });
  });

  test("a second flick after a pause steps on its first event", () => {
    const events = [...flickAt(0, 260), ...flickAt(3380 + 1100, 50)];
    expect(drive(gate(), events)).toEqual([0, 4480]);
  });

  test("a second flick after a short silence, the page idle, steps on its first event", () => {
    // the tail ended at 5; 450 ms later, frames coming all the while, the
    // next flick: nothing was merged, so 120 is a rise, not more of the tail
    const first = flickAt(0, 16);
    const at = (first.at(-1)?.[0] ?? 0) + 450;
    const second: Wheel[] = flickAt(at, 16).map(([t, d]) => [t, d, 16]);
    expect(drive(gate(), [...first, ...second], 200)).toEqual([0, at]);
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
    g.moving();
    expect(g.feed(300, 30)).toBe(0);
    expect(g.feed(350, 0)).toBe(0);
    expect(g.feed(400, 25)).toBe(0);
    g.still();
    expect(g.feed(450, 20)).toBe(0);
  });

  describe("events a window's own scroll took", () => {
    test("leave the rest of that flick as tail when the window hits its end", () => {
      const g = gate();
      const flick = flickAt(0, 33);
      // the window scrolls through the first six events, then reaches its end
      for (const [t, d] of flick.slice(0, 6)) g.absorb(t, d);
      const steps = flick.slice(6).filter(([t, d]) => g.feed(t, d)).length;
      expect(steps).toBe(0);
    });

    test("leave the rest of a slow flick as tail, its events far apart", () => {
      const g = gate();
      const flick = flickAt(0, 400);
      for (const [t, d] of flick.slice(0, 3)) g.absorb(t, d);
      const steps = flick.slice(3).filter(([t, d]) => g.feed(t, d)).length;
      expect(steps).toBe(0);
    });

    test("never step themselves", () => {
      const g = gate();
      expect(g.absorb(0, 120)).toBeUndefined();
      expect(g.feed(600, 120)).toBe(1);
    });

    test("leave a new flick at the end to step", () => {
      const g = gate();
      const flick = flickAt(0, 33);
      for (const [t, d] of flick) g.absorb(t, d);
      const second = flickAt(1500, 33);
      const steps = second.filter(([t, d]) => g.feed(t, d)).length;
      expect(steps).toBe(1);
    });
  });
});
