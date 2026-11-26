// PROTOTYPE, throwaway (map #118, ticket #135): the final wording of the
// opening (name window, terminal, now teaser), about and its closing line,
// the contact line and the 404, plus the reusable positioning line. Three
// candidate sets and today's wording, switchable via `?words=` and the
// floating bar ([ ], or the arrows on the bar). Dev only. Every line stays
// inside the fact sheet (#121), the voice (#123) and the story order (#124).
// The 404 shows on any unknown path, e.g. /nope?words=A.
import type { Exchange } from "../lib/terminal";
import { playTerminal } from "./terminal";

interface Variant {
  key: string;
  name: string;
  /** What this set tries, shown on the bar. */
  rules: string;
  /** Not on the site: for LinkedIn and GitHub. Shown on the bar. */
  positioning: string;
  role: string;
  exchanges: Exchange[];
  now: string;
  about: { paragraphs: string[]; closing: string };
  /** Empty: no sentence, the channels only. */
  contact: string;
  notFound: { err: string; line: string; places: string };
}

const PACE = ["day-1    designs", "week-1   prototype", "month-1  shipped"];

const VARIANTS: Variant[] = [
  {
    key: "A",
    name: "Plain",
    rules:
      "the winning terminal untouched · about = how I work, then remote · no pace example anywhere · contact has no sentence · 404 has no joke",
    positioning:
      "Senior product engineer. I design things and I build them. Give me a problem, not a spec.",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: ["A senior product engineer. I design things and I build them."],
      },
      {
        command: "cat ask",
        replies: ["Give me a problem, not a spec. Here’s what comes back:"],
      },
      { command: "ls -t ~/your-problem", replies: PACE },
    ],
    now: "on sabbatical, and building things anyway",
    about: {
      paragraphs: [
        "I like to start with the people who have the problem. At OpenBench that meant shadowing the scientists until I understood their work well enough to build for it, and it is still how I begin: I ask a lot of questions, show something rough early, and would rather be corrected in the first week than in the third month.",
        "I have worked remotely for the last five years, from a fair number of countries and time zones, so I write things down, keep my work where the team can see it, and don’t need to be in the room for it to move. I have also written a team’s onboarding and taken new engineers through it, because being easy to work with at a distance is mostly a matter of explaining yourself well.",
      ],
      closing: "what I did with a year off →",
    },
    contact: "",
    notFound: {
      err: "cd: no such place",
      line: "",
      places: "Nothing lives at this address. These do:",
    },
  },
  {
    key: "B",
    name: "The person",
    rules:
      "terminal says “usually” · about = where I’m from, then how I work, with the pace example (this site) and a joke last · contact has a friendly sentence · 404 keeps today’s joke",
    positioning:
      "Senior product engineer who designs and builds. I’d rather be given a problem than a spec.",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: ["A senior product engineer. I design things and I build them."],
      },
      {
        command: "cat ask",
        replies: [
          "Give me a problem, not a spec. Here’s what usually comes back:",
        ],
      },
      { command: "ls -t ~/your-problem", replies: PACE },
    ],
    now: "on sabbatical, still building",
    about: {
      paragraphs: [
        "I was born in the US and grew up in India, came back to the US for university, and then made Colorado home for a while. For the last five years I have worked from wherever I happened to be, so a team spread across countries is the only kind I know how to be on.",
        "To work with, I am the one asking what the problem actually is, and then sketching something the same day so that we have a thing to disagree about. This site is the nearest example: it went from a blank page to its designs in a day, and its first 21 tickets were built in the two days after that.",
        "I’m told I’m easy to work with, mostly by people in other time zones.",
      ],
      closing: "and lately, a sabbatical →",
    },
    contact: "Email reaches me fastest, wherever I am.",
    notFound: {
      err: "cd: no such place",
      line: "It was either never here or it left without saying.",
      places: "There are 6 places:",
    },
  },
  {
    key: "C",
    name: "Asked and answered",
    rules:
      "terminal gains a 4th command with the pace example · about is the reader’s two questions, answered · contact line is a joke · 404 has a new joke",
    positioning:
      "Senior product engineer. Give me a problem, not a spec: designs in a day, a prototype in a week, shipped in a month.",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: ["A senior product engineer. I design things and I build them."],
      },
      {
        command: "cat ask",
        replies: ["Give me a problem, not a spec. Here’s what comes back:"],
      },
      { command: "ls -t ~/your-problem", replies: PACE },
      {
        command: "ls -t ~/this-site",
        replies: ["day-1    designs", "day-3    built", "# usually slower"],
      },
    ],
    now: "a year off, spent mostly building",
    about: {
      paragraphs: [
        "What am I like to work with?",
        "Curious first. I learnt drug discovery by shadowing the scientists I was building for, and I do the same anywhere: I ask until I understand the problem, then show something rough quickly so that you can tell me where I’m wrong. I write down what I decided and why, so nobody has to ask me twice.",
        "Can I work remotely?",
        "I have for five years, across enough countries that I plan around time zones without thinking about it. I was born in the US, grew up in India and went back for university, so I have had some practice at being far from wherever the meeting is.",
      ],
      closing: "where I’ve been this year →",
    },
    contact: "Email is best. I answer faster than this terminal types.",
    notFound: {
      err: "cd: no such place",
      line: "I built every address on this site, so this one is on you.",
      places: "The ones that exist:",
    },
  },
  {
    key: "today",
    name: "Today",
    rules: "what master ships now, for comparison (reloads the page)",
    positioning: "(none yet)",
    role: "",
    exchanges: [],
    now: "",
    about: { paragraphs: [], closing: "" },
    contact: "",
    notFound: { err: "", line: "", places: "" },
  },
];

const STORE = "prototype-opening-copy";
const asked =
  new URL(location.href).searchParams.get("words") ??
  sessionStorage.getItem(STORE);
let current: Variant =
  VARIANTS.find((v) => v.key === asked) ??
  (VARIANTS.find((v) => v.key === "B") as Variant);

const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

function apply(replay: boolean): void {
  if (current.key === "today") return; // the build's own wording

  const role = q('[data-window="name"] .role');
  if (role) role.textContent = current.role;

  const teaser = q('[data-window="now"] .teaser');
  if (teaser) {
    const when = teaser.querySelector(".when");
    teaser.replaceChildren(...(when ? [when] : []), ` · ${current.now}`);
  }

  // a fresh node, so a typing loop still running draws into the old one
  const old = q('[data-window="term"] .term');
  if (old) {
    const term = old.cloneNode(true) as HTMLElement;
    term.dataset.terminal = JSON.stringify(current.exchanges);
    old.replaceWith(term);
    playTerminal(term, !replay);
  }

  const text = q('[data-window="about"] .text');
  const first = text?.querySelector("p");
  if (text && first) {
    // cloned from a built paragraph, so the scoped styles still apply
    text.replaceChildren(
      ...current.about.paragraphs.map((p) => {
        const el = first.cloneNode(false) as HTMLElement;
        el.textContent = p;
        // C's questions: short lines ending in "?", set in the accent
        if (p.endsWith("?") && p.length < 40) {
          el.style.color = "var(--ac)";
          el.style.marginBottom = "-8px";
        }
        return el;
      }),
    );
  }
  const closing = q<HTMLAnchorElement>('[data-window="about"] .closing');
  if (closing) {
    closing.textContent = current.about.closing;
    closing.href = "/now/";
  }

  const intro = q('[data-window="contact"] .intro');
  if (intro) {
    intro.textContent = current.contact;
    intro.style.display = current.contact ? "" : "none";
  }

  const nf = [
    ...document.querySelectorAll<HTMLElement>('[data-window="notfound"] .term > p'),
  ];
  // built order: the command, the error, the line, "There are N places:"
  if (nf.length === 4) {
    (nf[1] as HTMLElement).textContent = current.notFound.err;
    (nf[2] as HTMLElement).textContent = current.notFound.line;
    (nf[2] as HTMLElement).style.display = current.notFound.line ? "" : "none";
    (nf[3] as HTMLElement).textContent = current.notFound.places;
  }
}

// ---- the floating bar
const bar = document.createElement("div");
Object.assign(bar.style, {
  position: "fixed",
  left: "56px",
  bottom: "56px",
  zIndex: "2147483647",
  background: "#ff0",
  color: "#000",
  font: "13px/1.35 ui-monospace, monospace",
  padding: "6px 10px",
  borderRadius: "10px",
  boxShadow: "0 4px 18px #000a",
  display: "flex",
  gap: "8px",
  alignItems: "center",
  maxWidth: "min(56vw, 820px)",
});
const btn = (label: string, on: () => void) => {
  const b = document.createElement("button");
  b.textContent = label;
  Object.assign(b.style, {
    font: "inherit",
    background: "#000",
    color: "#ff0",
    border: "0",
    borderRadius: "6px",
    padding: "2px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    on();
  });
  return b;
};
const label = document.createElement("div");
bar.append(
  btn("←", () => cycle(-1)),
  label,
  btn("→", () => cycle(1)),
);

function render(): void {
  const i = VARIANTS.indexOf(current);
  label.replaceChildren();
  const head = document.createElement("b");
  head.textContent = `${current.key} (${current.name}) ${i + 1}/${VARIANTS.length}`;
  const rules = document.createElement("div");
  rules.textContent = current.rules;
  const pos = document.createElement("div");
  pos.textContent = `positioning line: ${current.positioning}`;
  pos.style.marginTop = "4px";
  pos.style.fontStyle = "italic";
  label.append(head, rules, pos);
}
function cycle(d: number): void {
  const i = VARIANTS.indexOf(current);
  const from = current;
  current = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length] as Variant;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("words", current.key);
  history.replaceState(history.state, "", url);
  // "today" is the build's own wording, so going to or from it reloads
  if (current.key === "today" || from.key === "today") {
    location.reload();
    return;
  }
  render();
  apply(true);
}

if (import.meta.env.DEV) {
  document.body.append(bar);
  addEventListener("keydown", (e: KeyboardEvent) => {
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      t.matches("input, textarea, select, [contenteditable]")
    )
      return;
    if (e.key === "[") cycle(-1);
    if (e.key === "]") cycle(1);
  });
  render();
  apply(true);
}
