// The about window's text: the one place the founder edits it. Paragraphs are
// plain sentences; the closing line is highlighted and leads into the projects.

export const ABOUT = {
  label: "~/about",
  heading: "about",
  paragraphs: [
    "I was born in the US and grew up in India, so home has always been a little of both. I came back to the US for university, and after it I made Colorado home for a while.",
    "For the last five years I've been travelling the world as a digital nomad, working from wherever I happen to land. Somewhere along the way the laptop became the one constant, and building things on it became the way I make sense of a new place.",
  ],
  closing: { text: "here are some of my personal projects →", href: "/work/" },
} as const;
