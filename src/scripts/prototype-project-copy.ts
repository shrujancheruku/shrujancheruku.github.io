// PROTOTYPE, throwaway (map #118, ticket #134): what do the featured
// projects' pitches and proof lines say, and the archive's pitches? Three
// candidate sets, switchable via `?copy=` and the floating bar ([ ], or the
// arrows on the bar). Dev only. Every line stays inside the fact sheet (#121),
// the voice (#123) and the proof-line rule in GLOSSARY.md. The featured order
// (issho, rapid-radiology, orca-flow, unmacos) is set in projects.yaml.

interface ProjectCopy {
  pitch: string;
  proof: string[];
}

interface Variant {
  key: string;
  name: string;
  /** The rules this set follows, shown on the bar. */
  rules: string;
  featured: Record<string, ProjectCopy> | null;
  archive: Record<string, string> | null;
}

const VARIANTS: Variant[] = [
  {
    key: "today",
    name: "Today",
    rules: "what master ships now, for comparison",
    featured: null,
    archive: null,
  },
  {
    key: "A",
    name: "His part first",
    rules:
      "3 lines each: his part and who for · where it stands · one decision · no jokes",
    featured: {
      issho: {
        pitch:
          "An app that brings a few people together over something they all already love.",
        proof: [
          "I designed and built issho on my own, for the people I kept meeting who wanted a community and couldn’t find one.",
          "It has been through a beta test and is live, as a personal project and not yet a launched service.",
          "I built each meeting around an activity, so that the activity breaks the ice and nobody has to.",
        ],
      },
      "rapid-radiology": {
        pitch:
          "Turn a radiologist’s shorthand findings into a finished report, in their own words.",
        proof: [
          "I built this for a friend, a practising radiologist, who used it on real reports before the commercial tools added LLMs.",
          "By his own count it raised his throughput by over 50%.",
          "I had it keep every normal line of his template word for word and change only the lines his findings replaced, so each report still read as his.",
        ],
      },
      "orca-flow": {
        pitch:
          "Hand it a spec and get back one pull request, built by AI workers side by side.",
        proof: [
          "This is how I build now: I write the spec, and orca-flow gives each ticket to its own worker and brings the work back for me to merge.",
          "I made it for my own projects and kept it modular, so it moves between my machines and friends can use it.",
          "This portfolio was built with it: the 21 tickets of its first milestone were built on 25 and 26 November 2026.",
        ],
      },
      unmacos: {
        pitch: "A keyboard-first desktop for macOS, installed with one command.",
        proof: [
          "This is the desktop I work in every day, built for myself because macOS is designed for a trackpad and I’d rather stay on the keyboard.",
          "I kept it modular, so it sets up each of my Macs the same way and friends can install it too.",
          "I kept the keys Omarchy uses on Linux, so anyone coming from it has nothing to relearn.",
        ],
      },
    },
    archive: {
      "claude-orchestrate":
        "My first go at building several tickets at once from one Claude Code session. orca-flow replaced it.",
      "TrueCrypt-Steganography":
        "Hide an encrypted TrueCrypt volume inside a video that still plays.",
    },
  },
  {
    key: "B",
    name: "The decisions",
    rules:
      "4 lines each: his part and the result in one line, then three decisions with their reasons · no jokes",
    featured: {
      issho: {
        pitch: "Find your people through the things you already love.",
        proof: [
          "issho is mine alone, from the research and the design to the code, and it is live after a beta test.",
          "I built every meeting around an activity, because doing something together is easier than making conversation with strangers.",
          "I kept the groups small and matched them on the things people already love.",
          "I made choosing who to meet again private, so that nobody is turned down in front of the group.",
        ],
      },
      "rapid-radiology": {
        pitch:
          "A tool that turned a radiologist’s shorthand findings into a finished report, in his own words.",
        proof: [
          "I built it alone for one radiologist, a friend, and by his own count it raised his throughput by over 50%.",
          "I ran two models side by side and let him copy the report he preferred, because the two really did write differently.",
          "I built the prompt to keep every normal line of his template word for word, because a report has to read as the radiologist’s own.",
          "I gave each of the 20 report types its own template, which he could edit in the app.",
        ],
      },
      "orca-flow": {
        pitch: "Turn a spec into one reviewed pull request.",
        proof: [
          "I built orca-flow for my own work, and it built this portfolio: the first 21 tickets in two days.",
          "I send each ticket to the cheapest model that can do it, decided by its size and risk, because most tickets don’t need the most expensive one.",
          "I have it size the tickets itself and check its estimates against tickets already shipped.",
          "I kept the merge for myself: everything comes back as one reviewed pull request, and merging it is my call.",
        ],
      },
      unmacos: {
        pitch: "A keyboard-first desktop for macOS, installed with one command.",
        proof: [
          "I built unmacos for myself and use it every day, on macOS 15 to 27 on Apple silicon.",
          "I kept the operating system and replaced only the desktop: windows tile themselves, and apps and settings open from a fuzzy menu.",
          "I gave everything on screen one theme, with 23 to choose from, so that changing it changes every app at once.",
          "I kept Omarchy’s keys, so anyone who knows that desktop on Linux already knows this one.",
        ],
      },
    },
    archive: {
      "claude-orchestrate":
        "An orchestrator that worked a backlog of GitHub issues into reviewed pull requests, several at a time. I rebuilt it as orca-flow.",
      "TrueCrypt-Steganography":
        "A script from 2018 that hides an encrypted TrueCrypt volume inside a video that still plays.",
    },
  },
  {
    key: "C",
    name: "The story",
    rules:
      "2 long lines each: why I built it, then what happened · a joke as a third line where one fits (tests jokes in project copy)",
    featured: {
      issho: {
        pitch:
          "A way to meet people by doing something together, for anyone who finds a community hard to find.",
        proof: [
          "I kept meeting people who wanted a community and didn’t know where to find one, so I designed and built issho for them, on my own.",
          "It puts a few people who love the same thing in one place to do it together, and it is live after a beta test, as a personal project that would need funding and a team to become a service.",
          "一緒 means “together”, which saved me a naming meeting.",
        ],
      },
      "rapid-radiology": {
        pitch:
          "Turn a radiologist’s shorthand findings into a finished report, in their own words.",
        proof: [
          "A friend who is a radiologist was writing the same normal report hundreds of times and changing a few lines, so I built him a tool that took only the abnormal findings and wrote the rest in his own words.",
          "He used it on real reports before the commercial tools added LLMs, and by his own count it raised his throughput by over 50%.",
        ],
      },
      "orca-flow": {
        pitch:
          "Build a whole spec with AI workers, and get back one pull request.",
        proof: [
          "A coding agent builds one ticket well and gets into trouble with five, so I built the part around it that decides the order, picks a model for each ticket, checks the work and hands me one pull request.",
          "I use it every day, and the first 21 tickets of this portfolio went through it in two days.",
          "If something on this page is broken, I’m the one who merged it.",
        ],
      },
      unmacos: {
        pitch: "A keyboard-first desktop for macOS, installed with one command.",
        proof: [
          "macOS is a good operating system under a desktop made for dragging things, so I replaced the desktop with one I can run from the keyboard, and it is what I work in every day.",
          "I set it up so that a new Mac takes one command and a few questions, which is how it gets onto my other machines, and onto a friend’s if they ask.",
          "The trackpad still works. I checked once.",
        ],
      },
    },
    archive: {
      "claude-orchestrate":
        "The first version of orca-flow, from before I let Orca run the workers.",
      "TrueCrypt-Steganography":
        "Hides an encrypted TrueCrypt volume inside a video that still plays, for some kinds of mp4 at least.",
    },
  },
];

const STORE = "prototype-project-copy";
const asked =
  new URL(location.href).searchParams.get("copy") ??
  sessionStorage.getItem(STORE);
let current: Variant =
  VARIANTS.find((v) => v.key === asked) ??
  (VARIANTS.find((v) => v.key === "A") as Variant);

// what the build rendered, kept so "today" can be restored
interface Original {
  pitch: HTMLElement;
  pitchText: string;
  list: HTMLElement | null;
  lines: HTMLElement[];
}
const featured = new Map<string, Original>();
const archive = new Map<string, { pitch: HTMLElement; text: string }>();

for (const copy of document.querySelectorAll<HTMLElement>(
  '[data-window^="copy-"] .copy',
)) {
  const name = copy.querySelector("h2")?.textContent?.trim();
  const pitch = copy.querySelector<HTMLElement>(".pitch");
  const list = copy.querySelector<HTMLElement>(".proof");
  if (!name || !pitch) continue;
  featured.set(name, {
    pitch,
    pitchText: pitch.textContent ?? "",
    list,
    lines: [...(list?.querySelectorAll<HTMLElement>("li") ?? [])],
  });
}
for (const entry of document.querySelectorAll<HTMLElement>("[data-entry]")) {
  const pitch = entry.querySelector<HTMLElement>(".pitch");
  if (pitch && entry.dataset.entry)
    archive.set(entry.dataset.entry, { pitch, text: pitch.textContent ?? "" });
}

function apply(): void {
  for (const [name, o] of featured) {
    const c = current.featured?.[name];
    o.pitch.textContent = c?.pitch ?? o.pitchText;
    if (!o.list || !o.lines[0]) continue;
    // cloned from a built line, so the component's scoped styles still apply
    const lines = c
      ? c.proof.map((text) => {
          const li = (o.lines[0] as HTMLElement).cloneNode(false) as HTMLElement;
          li.textContent = text;
          return li;
        })
      : o.lines;
    o.list.replaceChildren(...lines);
  }
  for (const [slug, o] of archive)
    o.pitch.textContent = current.archive?.[slug] ?? o.text;
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
);

function render(): void {
  const i = VARIANTS.indexOf(current);
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${VARIANTS.length}<br>${current.rules}`;
}
function cycle(d: number): void {
  const i = VARIANTS.indexOf(current);
  current = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length] as Variant;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("copy", current.key);
  history.replaceState(history.state, "", url);
  render();
  apply();
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
  apply();
}
