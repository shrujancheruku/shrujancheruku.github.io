// The `unmacos` composition (#41): a tiling desktop of terminal apps, each
// drawn as its real TUI. A window moves and the theme switches on each beat;
// one window opens from the launcher and closes again, and the loop has no
// seam. It shows its own theme switching on the scene only: the site's theme
// is never touched. The rules and numbers are in unmacos-session.ts.
import { THEMES, type ThemeName } from "../lib/themes";
import { type Composition, type Kit, onPhone } from "./kit";
import {
  arrange,
  BEAT_MS,
  type Beat,
  CYCLE,
  dwindle,
  HOLD_MS,
  jitter,
  nextSecond,
  START_WINDOWS,
  scroll,
  songClock,
  startingGraph,
  THEME_KEYS,
  TRACK_START,
  themeAfter,
} from "./unmacos-session";

/** The launcher's apps, as the README lists them. */
const LAUNCHER = [
  "btop",
  "firefox",
  "ghostty",
  "lazygit",
  "nvim",
  "orca",
  "spotify_player",
];
const QUERY = "laz";
const THEME_COUNT = 23;

const css = `
.scene.um{display:flex;flex-direction:column;gap:var(--gap);padding:calc(var(--gap)/2);background:var(--bg);color:var(--fg)}
.um *{transition:color .6s,background-color .6s,border-color .6s}
.um .d{opacity:.5}
.um .a{color:var(--ac)}
.um .sb{flex:none;display:flex;align-items:center;justify-content:space-between;font-size:calc(1.15*var(--u));height:calc(3*var(--u));padding:0 calc(1.2*var(--u));background:var(--dim);border-radius:calc(.7*var(--u));white-space:nowrap}
.um .sb b{color:var(--ac)}
.um .desk{flex:1;position:relative;min-height:0;margin:0 calc(var(--gap)/-2) calc(var(--gap)/-2) 0}
.scene.um .tile{position:absolute;padding:calc(.8*var(--u)) calc(.9*var(--u));font-size:calc(1.15*var(--u));line-height:1.5;white-space:nowrap;container-type:size;
  transition:left .5s cubic-bezier(.2,.9,.2,1),top .5s cubic-bezier(.2,.9,.2,1),width .5s cubic-bezier(.2,.9,.2,1),height .5s cubic-bezier(.2,.9,.2,1),opacity .3s,transform .3s,border-color .3s,background-color .6s}
.um.snap .tile{transition:none}
.um .tile.out{opacity:0;transform:scale(.9)}
.um .app{height:100%;display:flex;flex-direction:column;gap:.3em;min-height:0}
.um .app fieldset{border:.1em solid var(--line);border-radius:.45em;padding:0 .7em .3em;min-width:0;min-height:0;overflow:hidden;margin:0}
.um .app legend{padding:0 .4em;font-size:.92em}
.um .app legend b{color:var(--ac)}
.um .app fieldset.act{border-color:var(--ac)}
.um .row{display:flex;gap:.3em;min-height:0;min-width:0}
.um .col{display:flex;flex-direction:column;gap:.3em;min-height:0;min-width:0}
.um .g{flex:1 1 0;min-width:0;min-height:0}
.um .fill{height:100%}
.um .h{color:var(--hot)}
.um .add{color:var(--ac)}
.um .sel{background:var(--dim);border-radius:.2em}
.um .kv{display:flex;justify-content:space-between;gap:1em}
.um .m{display:flex;align-items:center;gap:.6em}
.um .m>span:first-child{flex:none;width:2.6em}
.um .pc{flex:none;width:3.2em;text-align:right}
.um .mt,.um .pg{flex:1;min-width:1em;height:.62em;background:var(--dim)}
.um .mt{-webkit-mask:repeating-linear-gradient(90deg,#000 0 .32em,transparent .32em .5em);mask:repeating-linear-gradient(90deg,#000 0 .32em,transparent .32em .5em)}
.um .mt i,.um .pg i{display:block;height:100%;background:linear-gradient(90deg,var(--ac),var(--hot));background-size:20em 100%;transition:width .8s}
.um .pg{border-radius:99px;overflow:hidden;height:.5em}
.um .btop .cpu{flex:none}
.um .btop .cores{flex:0 0 58%;padding-bottom:.2em}
.um .btop .cg{display:grid;grid-template-columns:1fr 1fr;column-gap:1em}
.um .graph{display:flex;align-items:flex-end;-webkit-mask:radial-gradient(circle,#000 48%,transparent 52%) 0 100%/.34em .34em;mask:radial-gradient(circle,#000 48%,transparent 52%) 0 100%/.34em .34em}
.um .graph i{flex:1;background:linear-gradient(0deg,var(--ac),var(--hot));background-size:100% 12em;background-position:bottom;transition:height .5s}
.um .btop .lft{flex:0 0 40%}
.um .pr{display:grid;grid-template-columns:5ch 1fr 5ch 5ch;column-gap:1ch}
.um .pr span:nth-child(n+3){text-align:right}
.um .pr.hd,.um .tk.hd{font-weight:700;color:var(--ac)}
.um .tk{display:grid;grid-template-columns:2ch 1.4fr 1fr 9ch;column-gap:1.5ch}
.um .tk span{overflow:hidden;text-overflow:ellipsis}
.um .tk span:last-child{text-align:right}
.um .tk.on{color:var(--ac);font-weight:700}
.um .sp .alb{flex:none}
.um .lg .side{flex:0 0 42%}
.um .lg .hint{display:flex;justify-content:space-between;gap:1em;color:var(--ac);overflow:hidden}
.um .lg .fl,.um .lg .br,.um .lg .log{flex:none}
.um .nv{gap:0}
.um .nv .tabs{display:flex;gap:.2em;margin-bottom:.3em}
.um .nv .tabs>*{padding:0 .8em;background:var(--dim);border-radius:.3em .3em 0 0}
.um .nv .tabs b{background:none;border-bottom:.12em solid var(--ac)}
.um .nv .code{white-space:pre;overflow:hidden}
.um .nv .ln{opacity:.4}
.um .nv .cl{background:var(--dim)}
.um .nv .cl .ln{opacity:1;color:var(--ac)}
.um .nv .sl{display:flex;gap:1em;align-items:center;background:var(--dim);overflow:hidden}
.um .nv .mode{background:var(--ac);color:var(--bg);padding:0 .8em}
.um .nv .r{margin-left:auto}
@container (max-width:40em){.um .btop .graph,.um .lg .main,.um .sp .alb,.um .tk .art,.um .nv .r{display:none}.um .lg .side{flex:1}.um .tk{grid-template-columns:2ch 1fr 5ch}.um .btop .cores{flex:1}}
@container (max-width:30em){.um .btop .proc,.um .sp .st,.um .lg .hint .d,.um .nv .tabs span{display:none}.um .btop .lft{flex:1}.um .btop .cg{grid-template-columns:1fr}.um .btop .cg .m:nth-child(n+5){display:none}}
@container (max-height:26em){.um .btop .net,.um .lg .br,.um .lg .sth,.um .sp .alb{display:none}}
@container (max-height:17em){.um .btop .ld,.um .lg .log{display:none}}
.um .menu{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) scale(.96);width:calc(40*var(--u));max-width:92%;background:var(--bg);border:calc(.22*var(--u)) solid var(--ac);border-radius:calc(.8*var(--u));
  box-shadow:0 calc(2*var(--u)) calc(6*var(--u)) #000a;padding:calc(1.2*var(--u)) calc(1.5*var(--u));font-size:calc(1.3*var(--u));line-height:1.65;white-space:pre;opacity:0;transition:opacity .18s,transform .18s;z-index:5;pointer-events:none}
.um .menu.on{opacity:1;transform:translate(-50%,-50%)}
.um .menu .sel{border-radius:3px}
.um .keys{position:absolute;left:50%;bottom:calc(2.4*var(--u));transform:translateX(-50%);z-index:6;background:var(--fg);color:var(--bg);padding:calc(.5*var(--u)) calc(1.4*var(--u));border-radius:99px;font-size:calc(1.25*var(--u));opacity:0;transition:opacity .2s;white-space:nowrap;max-width:96%;overflow:hidden}
.um .keys.on{opacity:1}
.um .keys kbd{font:inherit;border:1px solid currentColor;font-weight:700;border-radius:4px;padding:0 .4em;margin:0 .15em}
@media (max-width:760px){
  .scene.um .tile{font-size:calc(1.3*var(--u))}
  .um .sb{font-size:calc(1.3*var(--u))}
  .um .keys{font-size:calc(1.15*var(--u))}
  .um .keys .wide{display:none}
  .um .keys,.um legend,.um .sb>span,.um .kv>*,.um .m>span:first-child,.um .pr span,.um .hint>span,.um .tabs>*,
  .um .app fieldset>div:not(.row,.col,.cg,.m,.kv,.tk,.pr){overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .um legend{max-width:100%}
  .um [data-cut]{visibility:hidden}
}
`;

// ---- the apps, drawn as their real TUIs ---------------------------------

const meter = (pct: number, j?: number): string =>
  `<i class="mt"><i style="width:${pct}%"></i></i><span class="pc"${j === undefined ? "" : ` data-j="${j}"`}>${pct}%</span>`;

const CORES = [52, 38, 41, 19, 27, 12, 8, 5];

const PROCESSES: [string, string, string, string, boolean?][] = [
  ["1284", "firefox", "1.2G", "12.4"],
  ["4127", "nvim", "212M", "3.1", true],
  ["903", "ghostty", "188M", "2.8"],
  ["388", "WindowServer", "164M", "2.2"],
  ["5102", "spotify_player", "46M", "1.9"],
  ["612", "rift", "31M", "0.8"],
  ["640", "sketchybar", "24M", "0.6"],
  ["5220", "btop", "12M", "0.5"],
  ["5177", "lazygit", "28M", "0.3"],
  ["911", "tmux", "9M", "0.1"],
  ["2040", "television", "14M", "0.0"],
  ["1", "launchd", "18M", "0.0"],
];

const MEM: [string, string, number][] = [
  ["Used:", "6.7 GiB", 42],
  ["Available:", "9.3 GiB", 58],
  ["Cached:", "3.4 GiB", 21],
  ["Free:", "0.6 GiB", 4],
];

const btop = (): string =>
  `<div class="app btop"><fieldset class="cpu"><legend><b>1</b>cpu <span class="d">· menu · preset 0</span></legend><div class="row fill"><div class="graph g"></div><fieldset class="cores"><legend>M1 Pro <span class="d">3.2 GHz</span></legend><div class="m"><span><b>CPU</b></span>${meter(34, 34)}</div><div class="cg">${CORES.map((p, i) => `<div class="m"><span>C${i}</span>${meter(p, p)}</div>`).join("")}</div><div class="d ld">Load AVG: 2.41 2.10 1.93</div></fieldset></div></fieldset><div class="row g"><div class="col lft"><fieldset class="g"><legend><b>2</b>mem</legend><div class="kv"><span>Total:</span><b>16.0 GiB</b></div>${MEM.map(([k, v, p]) => `<div class="kv"><span>${k}</span><b>${v}</b></div><div class="m">${meter(p)}</div>`).join("")}</fieldset><fieldset class="net"><legend><b>3</b>net <span class="d">en0</span></legend><div class="kv"><span>↓ download</span><b>1.2 MiB/s</b></div><div class="kv"><span>↑ upload</span><b>84 KiB/s</b></div></fieldset></div><fieldset class="proc g"><legend><b>4</b>proc <span class="d">· filter · tree · cpu lazy</span></legend><div class="pr hd"><span>Pid</span><span>Program</span><span>Mem</span><span>Cpu%</span></div>${PROCESSES.map(([pid, name, mem, cpu, sel]) => `<div class="pr${sel ? " sel" : ""}"><span class="d">${pid}</span><span>${name}</span><span>${mem}</span><span>${cpu}</span></div>`).join("")}</fieldset></div></div>`;

const TRACKS: [string, string, boolean?][] = [
  ["Kids Off the Estate", "3:02"],
  ["Red Smoke", "3:21"],
  ["Harrison Lesser", "3:14", true],
  ["Low Life", "2:58"],
  ["Slice of Lime", "3:09"],
  ["On the Back Burner", "3:27"],
  ["Avalanche", "3:18"],
  ["Cash in Hand &amp; Fake IDs", "3:05"],
  ["Antibiotics", "2:51"],
  ["Mind the Gap", "3:33"],
];

const spotify = (): string =>
  `<div class="app sp"><fieldset><legend>Playback</legend><div><b class="a">▶ Harrison Lesser</b> · The Reytons</div><div class="d">Alcopops &amp; Charity Shops</div><div class="d st">repeat: off | shuffle: on | volume: 72% | device: unmacos</div><div class="m"><i class="pg"><i style="width:${songClock(TRACK_START).percent}%"></i></i><span class="d tm">${songClock(TRACK_START).label}</span></div></fieldset><fieldset class="g"><legend>Artist: The Reytons <span class="d">· Top Tracks</span></legend><div class="tk hd"><span>#</span><span>Title</span><span class="art">Artist</span><span>Time</span></div>${TRACKS.map(([title, time, on], i) => `<div class="tk${on ? " on" : ""}"><span class="d">${on ? "▶" : i + 1}</span><span>${title}</span><span class="art">The Reytons</span><span class="d">${time}</span></div>`).join("")}</fieldset><div class="row alb"><fieldset class="g"><legend>Albums</legend><div>Kids Off the Estate <span class="d">2021</span></div><div>What's Rock and Roll? <span class="d">2023</span></div><div>Ballad of a Bystander <span class="d">2024</span></div></fieldset><fieldset class="g"><legend>Related Artists</legend><div>The Sherlocks</div><div>The K's</div><div>The Lathums</div></fieldset></div></div>`;

const COMMITS: [string, string][] = [
  ["7d9573e", "feat(setup): add the wizard"],
  ["a3f1c20", "feat(themes): ristretto"],
  ["91be04d", "fix(bar): keep the clock clear of the notch"],
  ["5c2e7aa", "docs(readme): record the theme switch"],
  ["e08d1f3", "chore(release): v1.5.0"],
  ["3b77a12", "fix(menu): paste into the app you came from"],
  ["c41d9e0", "feat(themes): show wallpapers in the picker"],
];

const lazygit = (): string =>
  `<div class="app lg"><div class="row g"><div class="col side"><fieldset><legend><b>[1]</b> Status</legend><div><span class="a">✓</span> unmacos → main</div></fieldset><fieldset class="act fl"><legend><b>[2]</b> Files <span class="d">- Worktrees - Submodules</span></legend><div class="sel"><span class="h">&nbsp;M</span> home/dot_config/rift/config.toml</div><div><span class="a">A&nbsp;</span> themes/ristretto.toml</div><div><span class="h">&nbsp;M</span> home/dot_config/sketchybar/colors.sh</div><div><span class="h">??</span> docs/ristretto.png</div></fieldset><fieldset class="br"><legend><b>[3]</b> Local branches <span class="d">- Remotes - Tags</span></legend><div><span class="a">*</span> main <span class="a">✓</span></div><div>&nbsp; feat/ristretto <span class="h">↑2</span></div><div>&nbsp; fix/bar-gap</div></fieldset><fieldset class="g"><legend><b>[4]</b> Commits <span class="d">- Reflog</span></legend>${COMMITS.map(([h, m]) => `<div><span class="a">${h}</span> <span class="d">SC</span> ${m}</div>`).join("")}</fieldset><fieldset class="sth"><legend><b>[5]</b> Stash</legend></fieldset></div><div class="col g main"><fieldset class="g"><legend><b>[0]</b> Unstaged changes</legend><div><b>home/dot_config/rift/config.toml</b></div><div class="a">@@ -12,7 +12,7 @@ [settings.layout]</div><div> mode = "bsp"</div><div> [settings.layout.gaps]</div><div class="h">-inner = 6</div><div class="add">+inner = 4</div><div> outer = 4</div><div> </div><div class="a">@@ -31,6 +31,7 @@ [settings.ui]</div><div> [settings.ui.border]</div><div> width = 2</div><div class="add">+radius = 10</div><div> active = "theme"</div></fieldset><fieldset class="log"><legend>Command log</legend><div class="d">git add themes/ristretto.toml</div><div class="d">git fetch origin</div></fieldset></div></div><div class="hint"><span>Stage: &lt;space&gt; | Commit: c | Stash: s | Reset: D | Keybindings: ?</span><span class="d">0.44.1</span></div></div>`;

const NVIM_LINES = [
  `<span class="a">local</span> path = vim.fn.expand(<span class="a">"~/.local/state/unmacos/theme"</span>)`,
  "",
  `<span class="d">-- re-apply when the theme is switched</span>`,
  `vim.api.nvim_create_autocmd(<span class="a">"VimEnter"</span>, {`,
  `  once = <span class="a">true</span>,`,
  `  callback = <span class="a">function</span>()`,
  `    <span class="a">local</span> w = vim.uv.new_fs_event()`,
  `    w:start(path, {}, apply)`,
  `  <span class="a">end</span>,`,
  "})",
];

const nvim = (): string =>
  `<div class="app nv"><div class="tabs"><b>colourscheme.lua</b><span class="d">options.lua</span><span class="d">keymaps.lua</span></div><div class="code g" data-runs-off>${NVIM_LINES.map((l, i) => `<div${i === 9 ? ' class="cl"' : ""}><span class="ln">${String(i + 1).padStart(3)} </span>${l}</div>`).join("")}${'<div class="d">~</div>'.repeat(30)}</div><div class="sl" data-runs-off><b class="mode">NORMAL</b><span class="a">main</span><span>lua/config/colourscheme.lua</span><span class="r d">lua · utf-8</span><span>10:3 · Bot</span></div></div>`;

const APPS: Record<string, () => string> = {
  nvim,
  btop,
  spotify_player: spotify,
  lazygit,
};

// ---- the scene ------------------------------------------------------------

interface Win {
  name: string;
  el: HTMLElement;
}

interface View {
  tn: HTMLElement;
  desk: HTMLElement;
  menu: HTMLElement;
  keys: HTMLElement;
}

let view: View;
let wins: Win[] = [];
let theme = "";
let readings = startingGraph();
let seconds = TRACK_START;
/** The visitor switched theme while it played: hold that one for a beat. */
let hold = false;
let playing = false;

/** The site's current theme: the one the visitor chose. */
const siteTheme = (): string =>
  document.documentElement.dataset.theme || "paper";

/** Put the scene in a theme, or back in the site's own (`null`). Never touches the page's. */
function paint(name: string | null): void {
  const root = view.desk.closest<HTMLElement>(".scene");
  const palette = name === null ? undefined : THEMES[name as ThemeName];
  for (const k of ["bg", "fg", "ac", "dim", "line", "hot"] as const) {
    if (palette) root?.style.setProperty(`--${k}`, palette[k]);
    else root?.style.removeProperty(`--${k}`);
  }
  theme = name ?? siteTheme();
  view.tn.textContent = theme;
}

function layout(kit: Kit, focus: Win | undefined): void {
  const rects = dwindle(wins.length);
  wins.forEach((w, i) => {
    const r = rects[i];
    if (!r) return;
    Object.assign(w.el.style, {
      left: `${r.x}%`,
      top: `${r.y}%`,
      width: `calc(${r.w}% - var(--gap))`,
      height: `calc(${r.h}% - var(--gap))`,
    });
  });
  kit.focus(focus?.el ?? null);
}

/** A line of a tile: a panel, a line in one, or a line of the app's own. */
const LINES =
  "fieldset, fieldset > *, .cg > *, .app > :not(fieldset, .row, .col), .row > :not(fieldset, .col), .col > :not(fieldset)";

/** The box an element's clipped content shows in: inside its border. */
function inner(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect();
  return new DOMRect(
    r.left + el.clientLeft,
    r.top + el.clientTop,
    el.clientWidth,
    el.clientHeight,
  );
}

/**
 * On a phone a tile is small. A line too long for its panel ends in an
 * ellipsis (the css), and a line or a panel that does not fit whole in what
 * holds it is left out, never shown cut in half (#83). nvim's code runs off
 * its pane's edge, as a terminal's does.
 */
function fit(tile: HTMLElement): void {
  for (const el of tile.querySelectorAll("[data-cut]"))
    el.removeAttribute("data-cut");
  if (!onPhone()) return;
  for (const el of tile.querySelectorAll<HTMLElement>(LINES)) {
    if (el.closest("[data-cut], [data-runs-off]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    // what runs past the line itself, unless an ellipsis shortens it
    let cut = cs.overflowX === "visible" && el.scrollWidth > el.clientWidth + 1;
    for (let a = el.parentElement; a && !cut; a = a.parentElement) {
      const clips = a === tile || getComputedStyle(a).overflow !== "visible";
      if (clips) {
        // a legend sits on its fieldset's border
        const b =
          a.tagName === "FIELDSET" && el.tagName === "LEGEND"
            ? a.getBoundingClientRect()
            : inner(a);
        cut =
          r.top < b.top - 1 ||
          r.left < b.left - 1 ||
          r.bottom > b.bottom + 1 ||
          r.right > b.right + 1;
      }
      if (a === tile) break;
    }
    if (cut) el.dataset.cut = "";
  }
}

/** Refits a tile whenever its size changes (a window moves, the screen turns). */
let fitting: ResizeObserver | undefined;

function spawn(kit: Kit, name: string, instant: boolean): Win {
  const el = kit.el("div", "pn tile out", "", view.desk);
  el.innerHTML = APPS[name]?.() ?? "";
  fitting?.observe(el);
  const win = { name, el };
  wins.push(win);
  live(el);
  // sit at its place at once, then fade in
  el.style.transition = "none";
  layout(kit, win);
  void el.offsetWidth;
  el.style.transition = "";
  if (instant) el.classList.remove("out");
  else requestAnimationFrame(() => el.classList.remove("out"));
  return win;
}

/** Order the windows as `order` says, without moving the others. */
function reorder(order: readonly string[]): void {
  wins = order.map((n) => wins.find((w) => w.name === n)).filter(isWin);
}
const isWin = (w: Win | undefined): w is Win => w !== undefined;

function clear(): void {
  for (const w of wins) {
    fitting?.unobserve(w.el);
    w.el.remove();
  }
  wins = [];
}

/** Draw what moves: the cpu graph, the meters and the song's clock. */
function live(scope: ParentNode = view.desk): void {
  for (const g of scope.querySelectorAll<HTMLElement>(".graph")) {
    if (!g.children.length) g.innerHTML = "<i></i>".repeat(readings.length);
    [...g.children].forEach((b, i) => {
      (b as HTMLElement).style.height = `${readings[i]}%`;
    });
  }
  const clock = songClock(seconds);
  for (const t of scope.querySelectorAll<HTMLElement>(".tm")) {
    t.textContent = clock.label;
    const bar = t.previousElementSibling?.firstElementChild as
      | HTMLElement
      | undefined;
    if (bar) bar.style.width = `${clock.percent}%`;
  }
}

function tick(): void {
  readings = scroll(readings, Math.random);
  seconds = nextSecond(seconds);
  for (const pc of view.desk.querySelectorAll<HTMLElement>("[data-j]")) {
    const v = jitter(Number(pc.dataset.j), Math.random);
    pc.dataset.j = String(v);
    pc.textContent = `${v}%`;
    const fill = pc.previousElementSibling?.firstElementChild as
      | HTMLElement
      | undefined;
    if (fill) fill.style.width = `${v}%`;
  }
  live();
  for (const w of wins) fit(w.el);
}

const kbd = (keys: readonly string[]): string =>
  keys.map((k) => `<kbd>${k}</kbd>`).join("+");

function showKeys(beat: Beat): void {
  view.keys.innerHTML = `${kbd(beat.keys)} ${beat.does}<span class="wide"> · ${kbd(THEME_KEYS)} theme</span>`;
  view.keys.classList.add("on");
}

function drawMenu(query: string): void {
  const shown = LAUNCHER.filter((a) => a.includes(query));
  view.menu.replaceChildren();
  const head = document.createElement("div");
  head.innerHTML = `<span class="a">apps</span> <span class="d">${shown.length} / ${LAUNCHER.length}</span>`;
  const prompt = document.createElement("b");
  prompt.textContent = `❯ ${query}`;
  const cur = document.createElement("span");
  cur.className = "cur";
  view.menu.append(head, prompt, cur);
  for (const app of shown.slice(0, 6)) {
    const row = document.createElement("div");
    const picked = app === "lazygit" && query === QUERY;
    row.className = picked ? "sel" : "";
    row.innerHTML = `${picked ? "<b class='a'>●</b>" : " "} ${app}`;
    view.menu.append(row);
  }
}

function build(kit: Kit): void {
  const { root, el } = kit;
  root.classList.add("um");
  const bar = el("div", "sb", "", root);
  el("span", "", "", bar).innerHTML = '<b>1</b> <span class="d">2 3 4 5</span>';
  const right = el("span", "", "", bar);
  const tn = el("span", "a", "", right);
  right.append(` · ${THEME_COUNT} themes`);
  const desk = el("div", "desk", "", root);
  const menu = el("div", "menu", "", root);
  const keys = el("div", "keys", "", root);
  view = { tn, desk, menu, keys };
  fitting = new ResizeObserver((entries) => {
    for (const e of entries) fit(e.target as HTMLElement);
  });
  // a visitor who switches theme sees the composition carry on from theirs
  kit.onTheme((name) => {
    if (!playing) return;
    paint(name);
    hold = true;
  });
  frame(kit, START_WINDOWS);
}

/** The scene at once: these windows, the site's own theme, nothing mid-way. */
function frame(kit: Kit, names: readonly string[]): void {
  paint(null);
  view.keys.classList.remove("on");
  view.menu.classList.remove("on");
  clear();
  readings = startingGraph();
  seconds = TRACK_START;
  // every window sits at its place at once, nothing slides in
  kit.root.classList.add("snap");
  for (const n of names) spawn(kit, n, true);
  layout(kit, wins[0]);
  live();
  void kit.root.offsetWidth;
  kit.root.classList.remove("snap");
}

async function play(kit: Kit): Promise<void> {
  frame(kit, START_WINDOWS);
  paint(siteTheme());
  hold = false;
  playing = true;
  const stop = kit.every(1000, tick);
  /** Move, open or close a window, and switch the theme with it. */
  const switchTheme = (): void => {
    if (hold) hold = false;
    else paint(themeAfter(theme));
  };
  try {
    await kit.sleep(HOLD_MS - (CYCLE[0]?.at ?? 0));
    for (;;) {
      for (const beat of CYCLE) {
        showKeys(beat);
        let spent = 0;
        const wait = async (until: number): Promise<void> => {
          await kit.sleep(until - spent);
          spent = until;
        };
        if (beat.kind === "move") {
          await wait(beat.at);
          reorder(
            arrange(
              wins.map((w) => w.name),
              "move",
            ),
          );
          layout(kit, wins[0]);
          switchTheme();
        } else if (beat.kind === "launch") {
          await wait(300);
          drawMenu("");
          view.menu.classList.add("on");
          await wait(600);
          for (let i = 1; i <= QUERY.length; i++) {
            drawMenu(QUERY.slice(0, i));
            await wait(600 + i * 170);
          }
          await wait(beat.at - 140);
          view.menu.classList.remove("on");
          await wait(beat.at);
          spawn(kit, "lazygit", false);
          switchTheme();
        } else {
          await wait(500);
          layout(kit, wins.at(-1));
          await wait(beat.at);
          const last = wins.at(-1);
          last?.el.classList.add("out");
          switchTheme();
          await wait(beat.at + 250);
          if (last) fitting?.unobserve(last.el);
          last?.el.remove();
          wins = wins.slice(0, -1);
          layout(kit, wins[0]);
        }
        await wait(BEAT_MS);
      }
    }
  } finally {
    stop();
    playing = false;
  }
}

/** The share card: four windows open, no key label, the visitor's theme. */
function windows(kit: Kit): void {
  frame(kit, ["nvim", "btop", "spotify_player", "lazygit"]);
}

const composition: Composition = {
  css,
  card: "windows",
  flashes: true,
  build,
  play,
  frames: { windows },
};

export default composition;
