import { expect, test } from "bun:test";
import { crtMotion, shouldDraw } from "../src/lib/crt";

test("draws only while the effect is on and the tab is visible", () => {
  expect(shouldDraw({ on: true, hidden: false })).toBe(true);
  expect(shouldDraw({ on: false, hidden: false })).toBe(false);
  expect(shouldDraw({ on: true, hidden: true })).toBe(false);
});

test("reduced motion freezes flicker and the rolling band, nothing else", () => {
  expect(crtMotion(false)).toEqual({ flicker: 1, band: 1 });
  expect(crtMotion(true)).toEqual({ flicker: 0, band: 0 });
});
