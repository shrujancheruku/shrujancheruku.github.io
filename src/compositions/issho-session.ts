// What the `issho` composition shows (#40), apart from how it is drawn, so the
// rules can be tested: the six steps of the site (its own words, shortened),
// the half-cycle offset between site and app, the stops the site makes, and the
// launch cities. The wording is frozen here; nothing reads joinissho.com at
// build time, so it changes only by hand (#27).

export interface Step {
  kicker: string;
  heading: string;
  body: string;
}

/** The six steps, in order: plan, date, going, day, again, crew. */
export const STEPS: readonly Step[] = [
  {
    kicker: "It starts with a plan",
    heading: "Pick something you'd do anyway.",
    body: "Photo walks, bouldering, ramen crawls, board-game cafés. The activity breaks the ice, so you don't have to.",
  },
  {
    kicker: "Date set",
    heading: "Enough of you said yes. It's on.",
    body: "When enough people can make the same time, we lock in a date and split everyone into small groups.",
  },
  {
    kicker: "Going",
    heading: "A few people, not a crowd.",
    body: "Confirm your place and see who's coming. Groups stay small, so everyone gets a word in.",
  },
  {
    kicker: "On the day",
    heading: "Show up. The activity does the talking.",
    body: "The group chat opens ahead of time, so you can say hi and spot each other at the gates.",
  },
  {
    kicker: "How was it?",
    heading: "Pick who you'd meet again. Privately.",
    body: "Nobody sees your picks. Pick each other, and you're more likely to share a group again.",
  },
  {
    kicker: "A crew",
    heading: "Strangers on Saturday, regulars by spring.",
    body: "Clicked with your group? We'll offer you a crew: your own group chat, with a fresh plan every week or so.",
  },
];

/**
 * The six steps are one cycle. While the site is on step k the app shows step
 * k + 3, so the two never show the same step.
 */
export const APP_OFFSET = 3;

export const appStep = (siteStep: number): number =>
  (siteStep + APP_OFFSET) % STEPS.length;

/** Where the site rests: `section` null is the top; `hold` is how long it stays. */
export interface Stop {
  section: number | null;
  /** The step the site is on. At the top it is the first. */
  step: number;
  hold: number;
}

/** Hero 2.2 s, then 3.6 s a step. */
export const HERO_MS = 2200;
export const STEP_MS = 3600;

export const STOPS: readonly Stop[] = [
  { section: null, step: 0, hold: HERO_MS },
  ...STEPS.map((_, i) => ({ section: i, step: i, hold: STEP_MS })),
];

/** Time from the start to the last stop being reached, then held. */
export const totalMs = (): number => STOPS.reduce((sum, s) => sum + s.hold, 0);

export type CityState = "launched" | "next" | "planned";

export interface City {
  city: string;
  state: CityState;
  label: string;
}

export const CITIES: readonly City[] = [
  { city: "Tokyo", state: "launched", label: "launched" },
  { city: "Da Nang / Hoi An", state: "launched", label: "launched" },
  { city: "London", state: "next", label: "up next" },
  { city: "Mumbai", state: "planned", label: "planned" },
];

/** On the availability screen. It said "darker", which is wrong on the dark themes. */
export const AVAILABILITY_NOTE =
  "The stronger the colour, the more people are free.";
