// The `rapid-radiology` composition (#42): the app's own panels fill the window
// (inputs across the top, the two reports below). CT Chest is picked, four lines
// of shorthand are typed, Generate Reports is pressed and two reports arrive
// line by line. About 9 s to the end state, held 7.5 s, then it restarts.
// Touch has two beats: the findings, then the OpenAI report in their place.
import type { Composition, Kit } from "./kit";
import {
  FINDINGS,
  FINDINGS_CPS,
  GEMINI,
  HOLD_MS,
  KEY_LEAD,
  KEY_LINE,
  OPENAI,
  REPORT_TYPES,
  segments,
} from "./rapid-radiology-session";

interface View {
  chips: HTMLElement[];
  findings: HTMLElement;
  go: HTMLElement;
  key: HTMLElement;
  openai: HTMLElement;
  gemini: HTMLElement;
  panels: { input: HTMLElement; openai: HTMLElement; gemini: HTMLElement };
}
let view: View;

const css = `
.scene.rr{display:grid;grid-template:auto 1fr/1fr 1fr;gap:var(--gap);padding:calc(var(--gap)/2)}
.rr .pn{padding:calc(1.5*var(--u)) calc(1.9*var(--u))}
.rr .input{grid-column:1/-1}
.rr h3{font:inherit;font-weight:700;font-size:calc(1.4*var(--u));margin:0 0 calc(.7*var(--u));display:flex;gap:1ch;align-items:baseline}
.rr h3::before{content:"▪";color:var(--ac)}
.rr h3 small{font-weight:400;opacity:.5;font-size:calc(1.1*var(--u));margin-left:auto}
.rr .types{display:flex;gap:calc(.7*var(--u));flex-wrap:wrap;margin-bottom:calc(1.2*var(--u))}
.rr .types span{border:calc(.15*var(--u)) solid var(--dim);border-radius:99px;padding:calc(.15*var(--u)) calc(1.2*var(--u));font-size:calc(1.15*var(--u));transition:background .3s,border-color .3s}
.rr .types span.on{background:var(--ac);border-color:var(--ac);color:var(--bg);font-weight:700}
.rr .f{white-space:pre-wrap;min-height:calc(1.3*1.56*4*var(--u) + 2*var(--u));border:calc(.15*var(--u)) solid var(--dim);border-radius:calc(.8*var(--u));padding:calc(1*var(--u)) calc(1.3*var(--u));transition:border-color .3s}
.rr .f.live{border-color:var(--ac)}
.rr .foot{display:flex;align-items:center;gap:2ch;margin-top:calc(1*var(--u))}
.rr .btn{background:var(--ac);color:var(--bg);font-weight:700;border-radius:calc(.8*var(--u));padding:calc(.4*var(--u)) calc(1.5*var(--u));transition:transform .15s,filter .15s;white-space:nowrap}
.rr .btn.press{transform:scale(.93);filter:brightness(1.25)}
.rr .key{font-size:calc(1.1*var(--u));opacity:0;transition:opacity .5s}
.rr .key.on{opacity:.7}
.rr .key b{color:var(--ac)}
.rr .r div{opacity:0;transform:translateY(.4em);transition:opacity .35s,transform .35s;margin-bottom:.15em;color:color-mix(in srgb,var(--fg) 60%,transparent)}
.rr .r div.in{opacity:1;transform:none}
.rr .r mark{background:none;color:var(--ac);font-weight:500}
.rr .still .r div{transition:none}
@media (max-width:760px){
  .rr .wide,.rr .types span:not(.on){display:none}
  .scene.rr{grid-template:1fr/1fr}
  .rr .pn{padding:calc(1.1*var(--u)) calc(1.4*var(--u))}
  .rr .f{min-height:calc(1.3*1.56*3*var(--u) + 2*var(--u))}
  .rr .gemini{display:none}
  .rr:not(.done) .openai{display:none}
  .rr.done .f,.rr.done .btn,.rr.done h3.t{display:none}
  .rr.done .types{margin-bottom:calc(.4*var(--u))}
  .rr.done .foot{margin:0}
}
@media (max-width:760px){.rr.done{grid-template:auto 1fr/1fr}}
`;

function heading(
  kit: Kit,
  parent: HTMLElement,
  text: string,
  note: string,
  cls = "",
): void {
  const h = kit.el("h3", cls, text, parent);
  kit.el("small", cls === "t" ? "wide" : "wide", note, h);
}

function build(kit: Kit): void {
  const { root, el } = kit;
  root.classList.add("rr");
  const input = el("section", "pn input", "", root);
  const openai = el("section", "pn openai", "", root);
  const gemini = el("section", "pn gemini", "", root);

  el("h3", "t", "Report Type", input);
  const types = el("div", "types", "", input);
  const chips = REPORT_TYPES.map((t) => el("span", "", t, types));
  heading(kit, input, "Findings", "your shorthand", "t");
  const findings = el("div", "f", "", input);
  const foot = el("div", "foot", "", input);
  const go = el("span", "btn", "Generate Reports", foot);
  const key = el("span", "key", "", foot);
  el("b", "", KEY_LEAD.slice(0, 1), key);
  key.append(KEY_LEAD.slice(1));
  el("span", "wide", KEY_LINE.slice(KEY_LEAD.length), key);

  heading(kit, openai, "OpenAI Report", "full sentences");
  const a = el("div", "r", "", openai);
  heading(kit, gemini, "Gemini Report", "near-verbatim");
  const b = el("div", "r", "", gemini);
  for (const [box, lines] of [
    [a, OPENAI],
    [b, GEMINI],
  ] as const)
    for (const line of lines) {
      const row = el("div", "", "", box);
      for (const s of segments(line)) {
        if (s.found) el("mark", "", s.text, row);
        else row.append(s.text);
      }
    }
  view = {
    chips,
    findings,
    go,
    key,
    openai: a,
    gemini: b,
    panels: { input, openai, gemini },
  };
  reset(kit);
}

function reset(kit: Kit): void {
  view.chips.forEach((c) => {
    c.classList.remove("on");
  });
  view.findings.textContent = "";
  view.findings.classList.remove("live");
  view.go.classList.remove("press");
  view.key.classList.remove("on");
  for (const box of [view.openai, view.gemini])
    for (const row of box.children) row.classList.remove("in");
  kit.root.classList.remove("done");
  kit.focus(view.panels.input);
}

async function play(kit: Kit): Promise<void> {
  reset(kit);
  await kit.sleep(800);
  view.chips[0]?.classList.add("on");
  await kit.sleep(700);
  view.findings.classList.add("live");
  await kit.type(view.findings, FINDINGS, FINDINGS_CPS);
  view.findings.classList.remove("live");
  await kit.sleep(500);
  view.go.classList.add("press");
  await kit.sleep(220);
  view.go.classList.remove("press");
  await kit.sleep(450);
  kit.root.classList.add("done");
  kit.focus(null);
  view.panels.openai.classList.add("focus");
  view.panels.gemini.classList.add("focus");
  const rows = Math.max(
    view.openai.children.length,
    view.gemini.children.length,
  );
  for (let i = 0; i < rows; i++) {
    view.openai.children[i]?.classList.add("in");
    await kit.sleep(110);
    view.gemini.children[i]?.classList.add("in");
    await kit.sleep(150);
  }
  await kit.sleep(300);
  end(kit);
}

/** The end state: findings typed, both reports complete, the key line showing. */
function end(kit: Kit): void {
  reset(kit);
  view.chips[0]?.classList.add("on");
  view.findings.textContent = FINDINGS;
  for (const box of [view.openai, view.gemini])
    for (const row of box.children) row.classList.add("in");
  view.key.classList.add("on");
  kit.root.classList.add("done");
  kit.focus(null);
  view.panels.openai.classList.add("focus");
  view.panels.gemini.classList.add("focus");
}

const composition: Composition = {
  css,
  card: "end",
  holdMs: HOLD_MS,
  build,
  play,
  frames: { end },
};

export default composition;
