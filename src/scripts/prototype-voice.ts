// PROTOTYPE, throwaway (map #118, ticket #123): how should the portfolio
// sound? Three voices for the opening (the name window's role line, the
// terminal's exchanges, the now teaser) and one timeline entry (OpenBench),
// switchable via `?voice=` and the floating bar ([ ], or the arrows on the
// bar). Dev only. Every line stays inside the fact sheet (#121) and the
// positioning (#122).
import type { Exchange } from "../lib/terminal";
import { playTerminal } from "./terminal";

interface Voice {
  key: string;
  name: string;
  /** The rules this voice follows, shown on the bar. */
  rules: string;
  role: string;
  exchanges: Exchange[];
  now: string;
  openbench: string;
}

const OPENBENCH =
  "I joined as the first engineering hire and stayed the only engineer for three years, so the research, design, architecture and code were all mine. I learnt the science by shadowing the scientists, then built the screening pipeline that ran ML models across trillions of compounds. It found drug candidates, confirmed by experiment, from about 1,000 compounds tested, where a standard screen tests about 100,000.";

const VOICES: Voice[] = [
  {
    key: "today",
    name: "Today",
    rules: "what master ships now, for comparison",
    role: "product engineer",
    exchanges: [
      { command: "whoami", replies: ["product engineer"] },
      { command: "cat claim", replies: ["I design and build."] },
      { command: "cat ask", replies: ["Give me a problem, not a spec."] },
    ],
    now: "sabbatical",
    openbench:
      "First engineering hire at a computational chemistry startup. I built the workflows that ran cutting-edge AI models across trillions of compounds to find new drug candidates.",
  },
  // Round 2 (founder, 2026-11-27): conversational voice throughout; no career
  // achievements on the opening; the claim is about how product engineering
  // goes, and may run longer. The timeline entry is the same in all three.
  // VERDICT: C2 won. No jokes in the timeline (it feeds the resume).
  {
    key: "C1",
    name: "The pace",
    rules:
      "conversational · the claim is a pace: a day, a week, a month · then why it goes that fast · no joke",
    role: "senior product engineer",
    exchanges: [
      { command: "whoami", replies: ["A senior product engineer."] },
      {
        command: "cat how-i-work",
        replies: [
          "A day to designs. A week to a prototype. A month to shipped.",
          "I do the research, the design and the code myself, so nothing sits waiting on a handoff.",
        ],
      },
    ],
    now: "on sabbatical, and building things anyway",
    openbench: OPENBENCH,
  },
  {
    key: "C2",
    name: "What the job is",
    rules:
      "conversational · explains product engineering in plain words, the pace comes last · one joke, last",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: [
          "A product engineer, which mostly means I care more about the problem than the ticket.",
        ],
      },
      {
        command: "cat how-i-work",
        replies: [
          "I talk to the people who have the problem, sketch something, build it and put it in front of them. Then I watch what they do with it and go again.",
          "Usually that's designs in a day, a prototype in a week and something shipped in a month.",
        ],
      },
      {
        command: "man shrujan",
        replies: ["No manual entry for shrujan. Scroll down instead."],
      },
    ],
    now: "on sabbatical, and building things anyway",
    openbench: OPENBENCH,
  },
  {
    key: "C3",
    name: "Problem first",
    rules:
      "conversational · keeps today's 'a problem, not a spec', and says what you get back and when · the pace as a list",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: [
          "A senior product engineer. I design things and I build them.",
        ],
      },
      {
        command: "cat ask",
        replies: ["Give me a problem, not a spec. Here's what comes back:"],
      },
      {
        command: "ls -t ~/your-problem",
        replies: ["day-1    designs", "week-1   prototype", "month-1  shipped"],
      },
    ],
    now: "on sabbatical, and building things anyway",
    openbench: OPENBENCH,
  },
  {
    key: "final",
    name: "C3's whoami, C2's rest",
    rules:
      "VERDICT (founder, 2026-11-27): the whoami from C3, everything else from C2",
    role: "senior product engineer",
    exchanges: [
      {
        command: "whoami",
        replies: [
          "A senior product engineer. I design things and I build them.",
        ],
      },
      {
        command: "cat how-i-work",
        replies: [
          "I talk to the people who have the problem, sketch something, build it and put it in front of them. Then I watch what they do with it and go again.",
          "Usually that's designs in a day, a prototype in a week and something shipped in a month.",
        ],
      },
      {
        command: "man shrujan",
        replies: ["No manual entry for shrujan. Scroll down instead."],
      },
    ],
    now: "on sabbatical, and building things anyway",
    openbench: OPENBENCH,
  },
];

const STORE = "prototype-voice";
const asked =
  new URL(location.href).searchParams.get("voice") ??
  sessionStorage.getItem(STORE);
let current: Voice =
  VOICES.find((v) => v.key === asked) ??
  (VOICES.find((v) => v.key === "final") as Voice);

const q = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

function apply(replay: boolean): void {
  const role = q('[data-window="name"] .role');
  if (role) role.textContent = current.role;

  const teaser = q('[data-window="now"] .teaser');
  if (teaser) {
    const when = teaser.querySelector(".when");
    teaser.replaceChildren(...(when ? [when] : []), ` · ${current.now}`);
  }

  for (const org of document.querySelectorAll('[data-window="timeline"] .org'))
    if (org.textContent?.trim() === "OpenBench") {
      const desc = org.parentElement?.querySelector(".desc");
      if (desc) desc.textContent = current.openbench;
    }

  // a fresh node, so a typing loop still running draws into the old one
  const old = q('[data-window="term"] .term');
  if (old) {
    const term = old.cloneNode(true) as HTMLElement;
    term.dataset.terminal = JSON.stringify(current.exchanges);
    old.replaceWith(term);
    playTerminal(term, !replay);
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
  maxWidth: "min(52vw, 760px)",
});
const btn = (text: string, on: () => void) => {
  const b = document.createElement("button");
  b.textContent = text;
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
  btn("retype", () => apply(true)),
);

function render(): void {
  const i = VOICES.indexOf(current);
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${VOICES.length}<br>${current.rules}`;
}
function cycle(d: number): void {
  const i = VOICES.indexOf(current);
  current = VOICES[(i + d + VOICES.length) % VOICES.length] as Voice;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("voice", current.key);
  history.replaceState(history.state, "", url);
  render();
  apply(false);
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
