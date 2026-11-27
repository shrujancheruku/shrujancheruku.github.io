// The about window's text: the one place the founder edits it. Paragraphs are
// plain sentences; the closing line is highlighted and leads into the sabbatical.

export const ABOUT = {
  label: "~/about",
  heading: "about",
  paragraphs: [
    "I was born in the US and grew up in India, came back to the US for university, and then made Colorado home for a while. For the last five years I have worked from wherever I happened to be, so a team spread across countries is the only kind I know how to be on.",
    "To work with, I am the one asking what the problem actually is, and then sketching something the same day so that we have a thing to disagree about. This site is the nearest example: it went from a blank page to its designs in a day, and its first 21 tickets were built in the two days after that.",
    "I’m told I’m easy to work with, mostly by people in other time zones.",
  ],
  closing: { text: "and lately, a sabbatical →", href: "/now/" },
} as const;
