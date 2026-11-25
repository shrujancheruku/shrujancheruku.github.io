import { describe, expect, test } from "bun:test";
import {
  APP_OFFSET,
  AVAILABILITY_NOTE,
  appStep,
  CITIES,
  STEPS,
  STOPS,
  totalMs,
} from "../src/compositions/issho-session";

describe("the six steps of the site", () => {
  test("plan, date, going, day, again, crew, with their kickers", () => {
    expect(STEPS.map((s) => s.kicker)).toEqual([
      "It starts with a plan",
      "Date set",
      "Going",
      "On the day",
      "How was it?",
      "A crew",
    ]);
  });

  test("every step has a heading and a body line", () => {
    for (const s of STEPS) {
      expect(s.heading.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });
});

describe("the app is half a cycle ahead of the site", () => {
  test("the app shows the step three ahead of the site's", () => {
    expect(APP_OFFSET).toBe(3);
    expect([0, 1, 2, 3, 4, 5].map(appStep)).toEqual([3, 4, 5, 0, 1, 2]);
  });

  test("the two never show the same step", () => {
    for (let k = 0; k < STEPS.length; k++) expect(appStep(k)).not.toBe(k);
  });
});

describe("the stops of the site", () => {
  test("the top of the site first, then the six steps in order", () => {
    expect(STOPS.map((s) => s.section)).toEqual([null, 0, 1, 2, 3, 4, 5]);
  });

  test("the top of the site shows the day screen on the app", () => {
    const [top] = STOPS;
    expect(top?.step).toBe(0);
    expect(appStep(top?.step ?? -1)).toBe(3);
    expect(STEPS[appStep(top?.step ?? -1)]?.kicker).toBe("On the day");
  });

  test("hero 2.2 s, then 3.6 s a step", () => {
    expect(STOPS.map((s) => s.hold)).toEqual([
      2200, 3600, 3600, 3600, 3600, 3600, 3600,
    ]);
    expect(totalMs()).toBe(2200 + 6 * 3600);
  });
});

describe("the launch cities", () => {
  test("Tokyo and Da Nang / Hoi An launched, London up next, Mumbai planned", () => {
    expect(CITIES).toEqual([
      { city: "Tokyo", state: "launched", label: "launched" },
      { city: "Da Nang / Hoi An", state: "launched", label: "launched" },
      { city: "London", state: "next", label: "up next" },
      { city: "Mumbai", state: "planned", label: "planned" },
    ]);
  });
});

describe("the availability screen", () => {
  test("says the stronger the colour, the more people are free", () => {
    expect(AVAILABILITY_NOTE).toBe(
      "The stronger the colour, the more people are free.",
    );
  });
});
