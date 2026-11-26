// PROTOTYPE, throwaway (map #118, ticket #141): how does a featured project's
// copy window show its final copy (a pitch, two story sentences, an optional
// joke) on a wide screen without scrolling? Five layouts on the real projects
// workspace, switchable via `?layout=` and the floating bar ([ and ], or the
// arrows on the bar). Dev only, wide screens only: a phone already fits.
// The wording is fixed (#134, applied by prototype-project-copy.ts).

interface Variant {
  key: string;
  name: string;
  /** What changes, shown on the bar. */
  what: string;
}

const VARIANTS: Variant[] = [
  { key: "today", name: "Today", what: "what master lays out now: it overflows" },
  {
    key: "A",
    name: "Smaller type",
    what: "tiling untouched · title 38, pitch 14, lines 12 · tighter gaps",
  },
  {
    key: "B",
    name: "Stack shrinks to its rows",
    what: "the stack is only as tall as its five rows; the copy takes the rest · type untouched",
  },
  {
    key: "C",
    name: "Wider column",
    what: "copy and stack take 38% of the width, the composition 62% · type untouched",
  },
  {
    key: "D",
    name: "No stack window",
    what: "two windows, not three: the copy is the whole column and lists the projects itself · no + markers",
  },
  {
    key: "E",
    name: "B + compact type on short screens",
    what: "B, and under 620px of copy the type steps down (title 38, pitch 15, lines 12)",
  },
];

// the height of the stack when it is only as tall as its rows: the label
// (32px) and five rows of 34px, with their rules
const STACK = "204px";
const WIDE = "38%";

// only while the archive is shut: open, the workspace squeezes and the desktop
// script's own tiling stands
const on = (key: string) =>
  `html[data-layout="${key}"]:not(:has(.pane[data-window="archive"][style*="display: block"]))`;

const compact = (key: string) => `
  html[data-layout="${key}"] .copy { gap: 8px; padding-top: 20px; padding-bottom: 16px; }
  html[data-layout="${key}"] .copy h2 { font-size: clamp(26px, 10cqw, 38px); }
  html[data-layout="${key}"] .copy .pitch { font-size: 14px; line-height: 1.4; }
  html[data-layout="${key}"] .copy .proof { font-size: 12px; line-height: 1.5; }
`;

const shrunkStack = (key: string) => `
  ${on(key)} .pane[data-window^="copy-"] { height: calc(100% - ${STACK}) !important; }
  ${on(key)} .pane[data-window="stack"] { top: calc(100% - ${STACK}) !important; height: ${STACK} !important; }
  /* the taller window is no longer "short": undo the cramped sizes */
  html[data-layout="${key}"] .copy { gap: 12px; padding-top: 28px; padding-bottom: 22px; }
  html[data-layout="${key}"] .copy h2 { font-size: clamp(28px, 13cqw, 52px); }
  html[data-layout="${key}"] .copy .pitch { font-size: 16px; line-height: 1.45; }
  html[data-layout="${key}"] .copy .proof { font-size: 13px; line-height: 1.6; }
`;

const css = document.createElement("style");
css.textContent = `
@media (min-width: 761px) {
  .proto-nav { display: none; }

  /* A: smaller type */
  ${compact("A")}

  /* B: the stack shrinks to its rows */
  ${shrunkStack("B")}

  /* C: a wider column */
  ${on("C")} .pane[data-window^="copy-"],
  ${on("C")} .pane[data-window="stack"] { width: ${WIDE} !important; }
  ${on("C")} .pane[data-window^="comp-"] { left: ${WIDE} !important; width: calc(100% - ${WIDE}) !important; }

  /* D: no stack window */
  ${on("D")} .pane[data-window="stack"] { display: none !important; }
  ${on("D")} .pane[data-window^="copy-"] { height: 100% !important; }
  html[data-layout="D"] .copy { gap: 14px; padding-top: 28px; padding-bottom: 22px; }
  html[data-layout="D"] .copy h2 { font-size: clamp(28px, 13cqw, 52px); }
  html[data-layout="D"] .copy .pitch { font-size: 16px; line-height: 1.45; }
  html[data-layout="D"] .copy .proof { font-size: 13px; line-height: 1.6; display: grid; gap: 10px; }
  html[data-layout="D"] .copy .proof li::before { content: none; }
  html[data-layout="D"] .copy .more { display: none; }
  html[data-layout="D"] .proto-nav {
    display: grid;
    border-top: 1px solid var(--dim);
    margin: 4px -24px -22px -5cqw;
    font: 400 13px / 1 var(--mono);
  }
  html[data-layout="D"] .proto-nav > * {
    height: 30px;
    padding: 0 14px 0 5cqw;
    display: flex;
    align-items: center;
    border: 0;
    border-bottom: 1px solid var(--dim);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    opacity: 0.6;
  }
  html[data-layout="D"] .proto-nav > :last-child { border-bottom: 0; }
  html[data-layout="D"] .proto-nav > [aria-current] { opacity: 1; color: var(--ac); }
  html[data-layout="D"] .proto-nav > [aria-current]::before { content: "> "; white-space: pre; }

  /* E: B, with compact type when the copy window is short */
  ${shrunkStack("E")}
  @container (max-height: 620px) {
    ${compact("E").replace(/font-size: 14px/, "font-size: 15px")}
  }
}
`;

// D's list of projects inside each copy window: the stack's rows, cloned, each
// one clicking the real row so the desktop script still does the moving
function addNavs(): void {
  const rows = [
    ...document.querySelectorAll<HTMLElement>("[data-stack] > *"),
  ];
  for (const pane of document.querySelectorAll<HTMLElement>(
    '.pane[data-window^="copy-"]',
  )) {
    const n = Number((pane.dataset.window ?? "").replace("copy-", ""));
    const nav = document.createElement("nav");
    nav.className = "proto-nav";
    for (const row of rows) {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = row.textContent;
      if (Number(row.dataset.position) === n)
        item.setAttribute("aria-current", "true");
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        row.click();
      });
      nav.append(item);
    }
    pane.querySelector(".copy")?.append(nav);
  }
}

const STORE = "prototype-copy-layout";
const asked =
  new URL(location.href).searchParams.get("layout") ??
  sessionStorage.getItem(STORE);
let current: Variant =
  VARIANTS.find((v) => v.key === asked) ?? (VARIANTS[0] as Variant);

// ---- the floating bar
const bar = document.createElement("div");
Object.assign(bar.style, {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: "44px",
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
  maxWidth: "min(60vw, 820px)",
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

/** The state, on the bar: the copy window's size and whether its copy fits. */
function render(): void {
  document.documentElement.dataset.layout = current.key;
  const i = VARIANTS.indexOf(current);
  const copy = [
    ...document.querySelectorAll<HTMLElement>('.pane[data-window^="copy-"]'),
  ]
    .find((p) => p.style.display !== "none")
    ?.querySelector<HTMLElement>(".copy");
  let fit = "";
  if (copy) {
    const over = copy.scrollHeight - copy.clientHeight;
    const facts = copy.querySelector(".facts")?.getBoundingClientRect().top;
    const proof = copy.querySelector(".proof")?.getBoundingClientRect().bottom;
    const spare = Math.round((facts ?? 0) - (proof ?? 0));
    fit = ` · window ${copy.clientWidth}×${copy.clientHeight} · ${
      over > 0 ? `OVERFLOWS by ${over}px` : `fits, ${spare}px spare`
    }`;
  }
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${VARIANTS.length}${fit}<br>${current.what}`;
}
function cycle(d: number): void {
  const i = VARIANTS.indexOf(current);
  current = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length] as Variant;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("layout", current.key);
  history.replaceState(history.state, "", url);
  render();
  setTimeout(render, 300);
}

if (import.meta.env.DEV) {
  document.head.append(css);
  document.body.append(bar);
  addNavs();
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
  // the fit changes with the project on show and the screen's size
  setInterval(render, 500);
}
