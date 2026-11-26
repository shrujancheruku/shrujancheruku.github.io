import { expect, test } from "bun:test";
import {
  brightnessLift,
  crtMotion,
  maskAverage,
  scanline,
  scanlineAverage,
  shouldDraw,
} from "../src/lib/crt";

test("draws only while the effect is on and the tab is visible", () => {
  expect(shouldDraw({ on: true, hidden: false })).toBe(true);
  expect(shouldDraw({ on: false, hidden: false })).toBe(false);
  expect(shouldDraw({ on: true, hidden: true })).toBe(false);
});

test("reduced motion freezes flicker and the rolling band, nothing else", () => {
  expect(crtMotion(false)).toEqual({ flicker: 1, band: 1 });
  expect(crtMotion(true)).toEqual({ flicker: 0, band: 0 });
});

test("the mask and the scanlines each darken by their average", () => {
  // The RGB mask averages (1 + .84 + .84) / 3 across each pixel column triple.
  expect(maskAverage()).toBeCloseTo((1 + 0.84 + 0.84) / 3, 9);
  // The scanline factor 1 - .24 · (1 - s)² averages 1 - .24 · 3/8 over a period.
  expect(scanlineAverage()).toBeCloseTo(1 - 0.24 * (3 / 8), 9);
  let sum = 0;
  const n = 3000;
  for (let i = 0; i < n; i++) sum += scanline((3 * i) / n);
  expect(sum / n).toBeCloseTo(scanlineAverage(), 4);
});

test("the brightness lift is the inverse of the mask and scanline averages", () => {
  const lift = brightnessLift();
  expect(lift).toBeGreaterThan(1);
  expect(lift * maskAverage() * scanlineAverage()).toBeCloseTo(1, 9);
});
