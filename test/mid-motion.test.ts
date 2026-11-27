import { describe, expect, test } from "bun:test";
import { actDuring, type Ends, turned } from "../src/lib/mid-motion";

const at = (step: number, open = false, screen = 0) => ({
  step,
  open,
  screen,
});

/** A motion from step 0 to step 1. */
const down: Ends = { from: at(0), to: at(1) };

describe("an input during a motion", () => {
  test("runs at once when no motion is running", () => {
    expect(actDuring(null, at(2))).toBe("run");
  });

  test("that leads back to where the motion began turns it back", () => {
    expect(actDuring(down, at(0))).toBe("turn back");
  });

  test("that leads anywhere else waits", () => {
    expect(actDuring(down, at(2))).toBe("wait");
    expect(actDuring(down, at(1))).toBe("wait");
  });

  test("closing a window that is still opening turns back", () => {
    const opening: Ends = { from: at(4), to: at(4, true) };
    expect(actDuring(opening, at(4, false))).toBe("turn back");
  });

  test("an origin is the step and whether its disclosure was open", () => {
    const closing: Ends = { from: at(4, true), to: at(4) };
    expect(actDuring(closing, at(4, false))).toBe("wait");
    expect(actDuring(closing, at(4, true))).toBe("turn back");
  });

  test("on a phone, the next screen of the same step is not the origin", () => {
    const screenDown: Ends = { from: at(3, false, 0), to: at(3, false, 1) };
    expect(actDuring(screenDown, at(3, false, 2))).toBe("wait");
    expect(actDuring(screenDown, at(3, false, 0))).toBe("turn back");
  });

  test("during the first appearance there is no origin: everything waits", () => {
    const appearing: Ends = { from: null, to: at(0) };
    expect(actDuring(appearing, at(0))).toBe("wait");
    expect(actDuring(appearing, at(1))).toBe("wait");
  });
});

describe("a motion turned back", () => {
  test("now runs to where it began", () => {
    expect(turned(down)).toEqual({ from: at(1), to: at(0) });
  });

  test("a second reversal plays it forwards again", () => {
    const back = turned(down);
    expect(actDuring(back, at(1))).toBe("turn back");
    expect(turned(back)).toEqual(down);
  });
});
