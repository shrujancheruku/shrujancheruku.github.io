// The `orca-flow` composition (#39): this portfolio's own build, staged in
// three panes: the console (command, header, coordinator, the one question),
// the nine tickets and the pull request. About 17 s to the end state, which it
// then holds. The session itself is in orca-flow-session.ts.
import type { Composition, Kit } from "./kit";
import {
  AFTER_QUESTION,
  BEFORE_QUESTION,
  BRANCH,
  CLOCK_RATE,
  COMMAND,
  COORDINATOR,
  clockLabel,
  END_CLOCK_SECONDS,
  endState,
  initialState,
  type Move,
  QUESTION,
  READY,
  READY_DETAIL,
  READY_DETAIL_WIDE,
  SPEC,
  STATUS_LABEL,
  type State,
  step,
  TICKETS,
  titleOf,
} from "./orca-flow-session";

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

interface View {
  cmd: HTMLElement;
  header: HTMLElement;
  clock: HTMLElement;
  coordinator: HTMLElement;
  question: HTMLElement;
  answer: HTMLElement;
  answered: HTMLElement;
  rows: Map<number, { row: HTMLElement; status: HTMLElement }>;
  tally: HTMLElement;
  fill: HTMLElement;
  ready: HTMLElement;
  detail: HTMLElement;
  panes: { console: HTMLElement; tickets: HTMLElement; pr: HTMLElement };
}

let view: View;
let spin = 0;

const css = `
.scene.of{display:grid;grid-template:1fr auto/1fr 1fr;gap:var(--gap);padding:calc(var(--gap)/2)}
.of .pn{padding:calc(2.6*var(--u)) calc(2*var(--u)) calc(1.6*var(--u))}
.of .console{grid-area:1/1;display:flex;flex-direction:column;gap:calc(1*var(--u))}
.of .tickets{grid-area:1/2/3/3}
.of .pr{grid-area:2/1}
.of .p{color:var(--hot)}
.of .d{opacity:.55}
.of .row{display:grid;grid-template-columns:4ch 1fr 2ch 7ch 14ch;column-gap:1.2ch;line-height:2.3;white-space:nowrap;border-radius:.3em}
.of .row .ti{overflow:hidden;text-overflow:ellipsis}
.of .row.queued{opacity:.4}
.of .row.merged .st{color:var(--ac)}
.of .row.waiting .st{color:var(--hot);font-weight:700}
.of .st{display:flex;align-items:center;gap:1ch}
.of .sp{display:inline-block;width:1ch}
.of .row.flash{animation:of-flash .9s both}
.of .row.flash .st{animation:of-pop .35s both}
@keyframes of-flash{from{background:color-mix(in srgb,var(--ac) 45%,transparent)}}
@keyframes of-pop{from{transform:scale(1.5)}}
.of .bar{height:calc(.9*var(--u));border-radius:99px;background:var(--dim);overflow:hidden;margin:.5em 0 .2em}
.of .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--ac),var(--hot));transition:width .6s cubic-bezier(.2,.9,.2,1)}
.of .ready{font-weight:700;color:var(--ac)}
.of .in{animation:of-in .35s both}
@keyframes of-in{from{opacity:0;transform:translateX(-.5em)}}
.of .clock{font-variant-numeric:tabular-nums}
.of .stream{white-space:pre-wrap}
@media (max-width:760px){
  .of .lbl{display:none}
  .scene.of{display:flex;flex-direction:column;gap:calc(.8*var(--u))}
  .scene.of .pn{border:0;padding:calc(.4*var(--u)) calc(1.2*var(--u));background:none}
  .of .console{gap:calc(.4*var(--u))}
  .of .tickets{flex:none}
  .of .bar{margin:.3em 0 .1em}
  .of .wide,.of .row .ti{display:none}
  .of .row{grid-template-columns:5ch 2ch 7ch 1fr;line-height:1.75}
  .of .row.waiting .st{font-size:.9em}
}
@media (prefers-reduced-motion:reduce){.of .row.flash,.of .row.flash .st,.of .in{animation:none}}
`;

function build(kit: Kit): void {
  const { root, el } = kit;
  root.classList.add("of");
  const con = kit.pane("flow · console", "console");
  const tk = kit.pane("tickets", "tickets");
  const pr = kit.pane("pull request", "pr");

  const cmd = el("div", "", "", con);
  const header = el("div", "", "", con);
  const clock = el("span", "clock");
  const coordinator = el("div", "wide", "", con);
  const question = el("div", "wide", "", con);
  const answer = el("div", "wide", "", con);
  const answered = el("div", "wide d", "", con);

  const rows = new Map<number, { row: HTMLElement; status: HTMLElement }>();
  for (const t of TICKETS) {
    const row = el("div", "row queued", "", tk);
    row.dataset.ticket = String(t.id);
    el("b", "", `#${t.id}`, row);
    el("span", "ti", t.title, row);
    el("span", "d sz", t.size, row);
    el("span", "mo", t.model, row);
    const status = el("span", "st", "", row);
    row.addEventListener("animationend", () => row.classList.remove("flash"));
    rows.set(t.id, { row, status });
  }

  const tally = el("div", "", "", pr);
  const bar = el("div", "bar", "", pr);
  const fill = el("i", "", "", bar);
  const ready = el("div", "ready", "", pr);
  const detail = el("div", "d", "", pr);

  view = {
    cmd,
    header,
    clock,
    coordinator,
    question,
    answer,
    answered,
    rows,
    tally,
    fill,
    ready,
    detail,
    panes: { console: con, tickets: tk, pr },
  };
  reset(kit);
}

/** Show the command line with `typed` characters of the command. */
function prompt(parent: HTMLElement, text = ""): HTMLElement {
  parent.replaceChildren();
  const p = document.createElement("span");
  p.className = "p";
  p.textContent = "❯ ";
  const b = document.createElement("b");
  b.textContent = text;
  parent.append(p, b);
  return b;
}

function showHeader(seconds: number): void {
  const { header, clock } = view;
  header.replaceChildren();
  const flow = document.createElement("b");
  flow.className = "a";
  flow.style.color = "var(--ac)";
  flow.textContent = "flow";
  const rest = document.createElement("span");
  rest.append(` · ${SPEC}`);
  const wide = document.createElement("span");
  wide.className = "d";
  clock.textContent = clockLabel(seconds);
  wide.append(" · 9 tickets · ", clock);
  rest.append(wide);
  header.append(flow, rest);
}

function showReady(): void {
  view.ready.textContent = READY;
  view.detail.replaceChildren(
    READY_DETAIL,
    Object.assign(document.createElement("span"), {
      className: "wide",
      textContent: READY_DETAIL_WIDE,
    }),
  );
}

/** Draw the tickets, the tally and the bar for a state. */
function apply(state: State, flash: number | null = null): void {
  for (const t of TICKETS) {
    const entry = view.rows.get(t.id);
    if (!entry) continue;
    const s = state.status[t.id] ?? "queued";
    entry.row.className = `row ${s}`;
    entry.status.replaceChildren();
    if (s === "build" || s === "check") {
      const sp = document.createElement("span");
      sp.className = "sp";
      sp.textContent = SPIN[spin % SPIN.length] ?? "·";
      entry.status.append(sp);
    }
    entry.status.append(STATUS_LABEL[s]);
    if (flash === t.id) {
      // restart the animation if the row flashed a moment ago
      void entry.row.offsetWidth;
      entry.row.classList.add("flash");
    }
  }
  const branch = document.createElement("span");
  branch.className = "d";
  branch.textContent = BRANCH;
  const running = document.createElement("span");
  running.className = "wide d";
  running.textContent = state.running ? ` · ${state.running} in progress` : "";
  view.tally.replaceChildren(
    branch,
    " ",
    Object.assign(document.createElement("b"), {
      textContent: `${state.merged}/9`,
    }),
    " merged",
    running,
  );
  view.fill.style.width = `${(state.merged / TICKETS.length) * 100}%`;
}

/** The last ticket merged, until the ready line replaces it. */
function showLastMerged(id: number): void {
  const line = document.createElement("div");
  line.className = "in";
  const merged = document.createElement("span");
  merged.className = "d";
  merged.textContent = "merged";
  line.append(merged, ` #${id} ${titleOf(id)}`);
  view.detail.replaceChildren(line);
}

function reset(kit: Kit): void {
  spin = 0;
  prompt(view.cmd);
  view.header.replaceChildren();
  for (const el of [
    view.coordinator,
    view.question,
    view.answer,
    view.answered,
    view.ready,
    view.detail,
  ])
    el.replaceChildren();
  apply(initialState());
  kit.focus(view.panes.console);
}

/** A message arrives a word at a time, as it does from the model. */
async function stream(
  kit: Kit,
  into: HTMLElement,
  name: string,
  text: string,
): Promise<void> {
  into.replaceChildren();
  const head = kit.el("b", "", name, into);
  head.after(document.createElement("br"));
  const body = kit.el("span", "stream", "", into);
  const cursor = kit.el("span", "cur", "", into);
  let shown = "";
  for (const word of text.split(/(?<= )|(?<=\n)/)) {
    shown += word;
    body.textContent = shown;
    await kit.sleep(word.includes("\n") ? 260 : 55);
  }
  cursor.remove();
}

async function play(kit: Kit): Promise<void> {
  reset(kit);
  let state = initialState();
  let seconds = 0;
  let running = false;
  const stopSpin = kit.every(90, () => {
    spin++;
    for (const sp of view.panes.tickets.querySelectorAll(".sp"))
      sp.textContent = SPIN[spin % SPIN.length] ?? "·";
  });
  const stopClock = kit.every(100, () => {
    if (!running) return;
    seconds = Math.min(END_CLOCK_SECONDS, seconds + CLOCK_RATE / 10);
    view.clock.textContent = clockLabel(seconds);
  });

  const move = (m: Move) => {
    state = step(state, m);
    apply(state, m.to === "merged" ? m.ticket : null);
    if (m.to === "merged") showLastMerged(m.ticket);
  };

  try {
    await kit.sleep(700);
    const typed = prompt(view.cmd);
    await kit.type(typed, COMMAND, 16);
    await kit.sleep(500);
    showHeader(0);
    running = true;
    await kit.sleep(500);
    await stream(kit, view.coordinator, COORDINATOR.name, COORDINATOR.message);
    await kit.sleep(600);

    kit.focus(view.panes.tickets);
    for (const m of BEFORE_QUESTION) {
      await kit.sleep(m.wait);
      move(m);
    }
    await kit.sleep(300);
    move({ ticket: 50, to: "waiting" });
    kit.focus(view.panes.console);
    view.question.replaceChildren();
    view.question.className = "wide in";
    const title = kit.el("b", "", QUESTION.title, view.question);
    title.style.color = "var(--hot)";
    view.question.append(document.createElement("br"), QUESTION.ask);
    const typedAnswer = prompt(view.answer);
    await kit.sleep(1500);
    await kit.type(typedAnswer, QUESTION.answer, 12);
    await kit.sleep(400);

    kit.focus(view.panes.tickets);
    for (const m of AFTER_QUESTION) {
      await kit.sleep(m.wait);
      move(m);
    }
    // the answered line replaces the question, as in the prototype
    view.question.replaceChildren();
    view.answer.replaceChildren();
    view.answered.textContent = QUESTION.answered;
    await kit.sleep(500);
    kit.focus(view.panes.pr);
    running = false;
    seconds = END_CLOCK_SECONDS;
    view.clock.textContent = clockLabel(seconds);
    showReady();
  } finally {
    stopSpin();
    stopClock();
  }
}

/** The end state: the share card's frame, and the state the composition holds. */
function end(kit: Kit): void {
  const state = endState();
  prompt(view.cmd, COMMAND);
  showHeader(END_CLOCK_SECONDS);
  view.coordinator.replaceChildren();
  const head = kit.el("b", "", COORDINATOR.name, view.coordinator);
  head.after(document.createElement("br"));
  kit.el("span", "stream", COORDINATOR.message, view.coordinator);
  view.question.className = "wide";
  view.question.replaceChildren();
  view.answer.replaceChildren();
  view.answered.textContent = QUESTION.answered;
  spin = 0;
  apply(state);
  showReady();
  kit.focus(view.panes.pr);
}

const composition: Composition = {
  css,
  card: "end",
  build,
  play,
  frames: { end },
};

export default composition;
