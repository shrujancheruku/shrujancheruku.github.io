// The `issho` composition (#40): the marketing site and the app, drawn by hand
// from text and shapes in the theme's colours (no capture, no screenshot), in
// three gapped panes: the site (left), the app under a permanent header (top
// right) and the launch cities (bottom right). The six steps of the site are
// one cycle: while the site is on step k the app shows step k + 3. About 24 s
// to the last step, which it then holds. Wording and stops: issho-session.ts.
import { LOGO } from "./issho-logo";
import {
  AVAILABILITY_NOTE,
  appStep,
  CITIES,
  STEPS,
  STOPS,
} from "./issho-session";
import type { Composition, Kit } from "./kit";

const dots = (n: number): string =>
  `<span class="dash">${"<i></i>".repeat(n)}</span>`;

// one drawing per step, used small on the site and large in the app
const CARDS: readonly string[] = [
  `<h4>Photo walk from Kichijoji station, ending at a café</h4><div class="s">Kichijoji · about 2.5 hours</div>
   <svg class="map" viewBox="0 0 240 132">
    <g class="st" transform="rotate(-7 120 66)"><path d="M-30 14H270M-30 40H270M-30 70H270M-30 98H270M-30 124H270M18 -30V170M54 -30V170M92 -30V170M132 -30V170M170 -30V170M210 -30V170"/></g>
    <path class="mj" d="M-10 118C50 108 120 126 250 98M222 -10C214 40 226 90 218 142"/>
    <path class="park" d="M30 50C58 36 122 40 154 52C174 60 176 92 154 104C118 120 58 118 36 102C18 88 16 60 30 50Z"/>
    <path class="pond" d="M50 72C64 60 96 66 120 64C140 62 152 72 146 84C140 96 112 92 92 96C72 100 54 98 46 88C42 82 44 76 50 72Z"/>
    <path class="rail" d="M-10 30L250 6"/><path class="ties" d="M-10 30L250 6"/>
    <path class="rt" pathLength="1" d="M188 13C190 30 180 44 162 52C138 60 96 50 58 60C36 66 30 86 44 98C60 110 112 110 142 102C162 96 180 100 204 92"/>
    <rect class="sta" x="174" y="6" width="28" height="11" rx="3" transform="rotate(-5 188 12)"/>
    <text class="pl" x="100" y="82">Inokashira Park</text><text class="lb" x="170" y="28" text-anchor="end">Kichijoji Sta.</text>
    <g class="pin"><circle cx="188" cy="13" r="6.5"/><text x="188" y="15.6">1</text><circle cx="36" cy="80" r="6.5"/><text x="36" y="82.6">2</text><circle cx="204" cy="92" r="6.5"/><text x="204" y="94.6">3</text></g></svg>
   <ol class="stops"><li><div>Kichijoji Station, park exit<span class="s">Meet here</span></div></li><li><div>Inokashira Park<span class="s">About 90 minutes of photos</span></div></li><li><div>A café on Nanaibashi-dori<span class="s">Coffee and comparing shots</span></div></li></ol><b>4 of 5 going</b>${dots(5)}`,
  `<h4>When people can go</h4><div class="s">${AVAILABILITY_NOTE}</div>
   <div class="grid"><b></b><span>Morning</span><span>Afternoon</span><span>Evening</span><b>Fri</b><i></i><i></i><i class="m"></i><b>Sat</b><i class="m"></i><i class="pick">2 PM</i><i class="m"></i><b>Sun</b><i class="m"></i><i></i><i></i></div><b>Sat, Nov 15, 2:00 PM</b>`,
  `<h4>Can you go?</h4><div class="s">Please answer by Thu, Nov 13 · Sat, Nov 15, 2:00 PM</div>
   <svg class="ring" viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="38"/><circle class="arc" cx="50" cy="50" r="38" transform="rotate(170 50 50)"/><text x="50" y="56">3</text><text class="sm" x="50" y="67">confirmed so far</text>
   <circle class="av" cx="12.6" cy="56.6" r="6"/><circle class="av" cx="25.6" cy="20.9" r="6"/><circle class="av" cx="74.4" cy="20.9" r="6"/><circle class="av no" cx="87.4" cy="56.6" r="6"/><circle class="av no" cx="50" cy="88" r="6"/></svg>
   <span class="btn">I can go</span><span class="ghost">I cannot go</span>`,
  `<h4>It's today: check in when you arrive</h4><div class="s">Kichijoji Station, park exit · 2:00 PM</div>
   <div class="chat"><span class="s">Group chat · Aoi, Kenji, Maya, Sam and you</span><div>Maya: I'm by the ticket gates, green jacket.</div><div class="me">Two stops away, excited to meet you all!</div></div>
   <div class="row2"><span class="btn">I'm here</span><span class="out">Share with someone you trust</span></div>`,
  `<h4>Who would you meet again?</h4><div class="s" style="margin-bottom:.8em">Private: nobody sees who you pick.</div>
   <div class="pk">Aoi<i class="y"></i></div><div class="pk">Kenji<i></i></div><div class="pk">Maya<i class="y"></i></div><div class="pk">Sam<i></i></div>`,
  `<div class="crew"><div class="s" style="opacity:.85">A crew for you</div><h4>Photo walk crew</h4><div class="ln"><b>A</b><b>M</b><b>S</b><b>You</b></div></div>
   <b>You got on well. Keep meeting as a crew?</b><div class="s">Something you all love: photo walks.</div><span class="btn">Yes, join the crew</span><span class="ghost">No, thanks</span>`,
];

const css = `
.scene.is{display:grid;grid-template:1fr auto/1.7fr 1fr;gap:var(--gap);padding:calc(var(--gap)/2)}
.is .site{grid-area:1/1/3/2}.is .app{grid-area:1/2}.is .cities{grid-area:2/2}
.is .site .lbl,.is .app .lbl{display:none}
.is .vp{position:absolute;inset:0;overflow:hidden;container-type:inline-size}
.is .pg{position:absolute;left:0;top:0;width:100%;will-change:transform;transition:transform 1.3s cubic-bezier(.65,0,.2,1);font-size:1.85cqw;line-height:1.6;padding:3.5cqw 5cqw 6cqw 11cqw}
.is .pg::before{content:"";position:absolute;left:6.5cqw;top:9cqw;bottom:0;width:.35cqw;background:var(--dim)}
.is .logo{display:block;height:9cqw;width:auto;overflow:visible}
.is .logo [fill="#131B40"]{fill:var(--fg)}.is .logo [fill="#DEA92C"]{fill:var(--ac)}.is .logo [fill="#DA4528"]{fill:var(--hot)}
.is .logo [stroke="#131B40"],.is .logo [stroke="#DEA92C"]{stroke:var(--bg)}
.is .logo *{transition:fill .45s,stroke .45s}
.is .hero{padding:5cqw 0 9cqw}.is .hero h1{font-size:6.6cqw;line-height:1.05;max-width:14ch}.is .hero p{max-width:44ch;opacity:.65;margin:2cqw 0 2.6cqw}
.is .cta{display:inline-block;background:var(--ac);color:var(--bg);font-weight:700;border-radius:.6em;padding:.35em 1.1em}
.is .sec{position:relative;display:grid;grid-template-columns:1.05fr 1fr;gap:4cqw;padding:3cqw 0 6cqw;align-items:start}
.is .sec::before{content:"";position:absolute;left:-5.65cqw;top:3.2cqw;width:2cqw;height:2cqw;border-radius:50%;background:var(--bg);border:.35cqw solid var(--line);transition:.4s}
.is .sec.at::before{background:var(--ac);border-color:var(--ac);box-shadow:0 0 0 .8cqw color-mix(in srgb,var(--ac) 25%,transparent)}
.is .sec small{font-size:1.5cqw;opacity:.6}.is .sec h2{font-size:3.5cqw;line-height:1.12;margin:.3em 0 .6em}.is .sec p{opacity:.65;font-size:1.65cqw}
.is .sec .c{font-size:1.5cqw}
.is .c{border:.12em solid var(--dim);border-radius:1em;padding:1.1em 1.2em;background:color-mix(in srgb,var(--dim) 35%,var(--bg));line-height:1.5;transition:background .45s,border-color .45s}
.is .c h4{font-size:1.15em;line-height:1.25}.is .c .s{opacity:.6;font-size:.88em}
.is .c .btn{display:block;text-align:center;background:var(--ac);color:var(--bg);font-weight:700;border-radius:.6em;padding:.45em;margin-top:.9em}
.is .c .ghost{display:block;text-align:center;font-size:.88em;opacity:.6;margin-top:.5em;text-decoration:underline}
.is .map{display:block;width:100%;border-radius:.7em;margin:.8em 0;background:color-mix(in srgb,var(--fg) 7%,var(--bg));overflow:hidden}
.is .map .st path{stroke:var(--bg);stroke-width:2.2;fill:none}.is .map .mj{stroke:var(--bg);stroke-width:5.5;fill:none;stroke-linecap:round}
.is .map .park{fill:color-mix(in srgb,var(--fg) 13%,var(--bg))}.is .map .pond{fill:color-mix(in srgb,var(--fg) 30%,var(--bg))}
.is .map .rail{stroke:color-mix(in srgb,var(--fg) 45%,var(--bg));stroke-width:3.4;fill:none}.is .map .ties{stroke:var(--bg);stroke-width:1.6;stroke-dasharray:3 3;fill:none}
.is .map .sta{fill:var(--fg)}
.is .map .rt{stroke:var(--hot);stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:0}
.is .map text{font:500 6.5px var(--mono);fill:var(--fg)}.is .map .pl{font-style:italic;text-anchor:middle;opacity:.7}.is .map .lb{opacity:.8}
.is .map .pin circle{fill:var(--bg);stroke:var(--hot);stroke-width:2}.is .map .pin text{font-weight:700;font-size:7px;text-anchor:middle}
.is .stops{list-style:none;counter-reset:n}.is .stops li{counter-increment:n;display:flex;gap:.7em;align-items:baseline;margin-bottom:.35em}
.is .stops li::before{content:counter(n);flex:none;width:1.5em;height:1.5em;border-radius:50%;border:.14em solid var(--hot);display:grid;place-items:center;font-size:.78em;font-weight:700}
.is .stops li .s{display:block}
.is .dash{display:inline-flex;gap:.35em;margin-left:.8em;vertical-align:middle}.is .dash i{width:1.1em;height:.3em;border-radius:9px;background:var(--ac)}.is .dash i:last-child{background:var(--dim)}
.is .grid{display:grid;grid-template-columns:2.6em repeat(3,1fr);gap:.35em;margin:.9em 0;font-size:.85em;align-items:center}
.is .grid span{opacity:.6;text-align:center}.is .grid b{font-weight:400;opacity:.6}
.is .grid i{height:2em;border-radius:.4em;background:var(--dim);display:grid;place-items:center;font-style:normal;font-weight:700;color:var(--bg);font-size:.9em}
.is .grid i.m{background:color-mix(in srgb,var(--fg) 28%,var(--dim))}.is .grid i.pick{background:var(--ac)}
.is .ring{display:block;width:62%;margin:.6em auto}.is .ring circle{fill:none;stroke-width:2.5}.is .ring .tr{stroke:var(--dim);stroke-dasharray:3 5}.is .ring .arc{stroke:var(--ac);stroke-dasharray:239;stroke-dashoffset:125;stroke-linecap:round}
.is .ring .av{fill:color-mix(in srgb,var(--dim) 35%,var(--bg));stroke:var(--ac)}.is .ring .no{stroke:var(--line);stroke-dasharray:3 3}.is .ring text{fill:var(--fg);font:700 26px var(--mono);text-anchor:middle}.is .ring .sm{font-size:5.5px;font-weight:400;opacity:.7}
.is .chat{border:.12em solid var(--dim);border-radius:.8em;padding:.8em;margin:.8em 0;background:var(--bg);display:flex;flex-direction:column;gap:.5em;min-height:8.5em}
.is .chat div{max-width:82%;border-radius:.8em;padding:.4em .8em;background:var(--dim)}.is .chat .me{align-self:flex-end;background:var(--ac);color:var(--bg)}
.is .row2{display:flex;gap:.6em}.is .row2 .btn{flex:none;padding:.45em 1em;margin:0}.is .row2 .out{border:.12em solid var(--line);border-radius:.6em;padding:.4em .8em;font-size:.9em;flex:1;text-align:center}
.is .pk{display:flex;justify-content:space-between;align-items:center;border-top:.1em solid var(--dim);padding:.5em 0}
.is .pk i{width:1.15em;height:1.15em;border-radius:.25em;border:.12em solid var(--line);display:grid;place-items:center}.is .pk i.y{background:var(--ac);border-color:var(--ac)}
.is .pk i.y::after{content:"";width:.28em;height:.56em;border:solid var(--bg);border-width:0 .14em .14em 0;transform:translateY(-.05em) rotate(45deg)}
.is .crew{background:var(--ac);color:var(--bg);border-radius:.8em;padding:1em;margin:-.2em -.3em .9em}.is .crew .ln{display:flex;justify-content:space-between;margin-top:.9em;position:relative}
.is .crew .ln::before{content:"";position:absolute;left:1em;right:1em;top:50%;height:.12em;background:var(--bg);opacity:.5}
.is .crew .ln b{position:relative;width:2.6em;height:2.6em;border-radius:50%;background:var(--bg);color:var(--ac);display:grid;place-items:center;font-size:.85em}
.is .av{position:absolute;inset:0;container-type:size;background:var(--bg)}
.is .apphd{position:absolute;inset:0 0 auto;height:min(16cqw,13cqh);padding:0 5cqw;display:flex;align-items:center;justify-content:space-between;border-bottom:.3cqw solid var(--dim);z-index:2}
.is .apphd .logo{height:68%}.is .apphd i{width:min(7cqw,5.6cqh);height:min(7cqw,5.6cqh);border-radius:50%;border:.5cqw solid var(--line);background:var(--dim)}
.is .scrn{position:absolute;inset:min(16cqw,13cqh) 0 0;display:flex;flex-direction:column;justify-content:center;padding:5cqw;font-size:min(4.1cqw,2.9cqh);opacity:0;transition:opacity .6s}
.is .scrn.on{opacity:1}
.is .scrn.on .rt{animation:is-draw 2.4s .3s both ease-in-out}.is .scrn.on .pin circle,.is .scrn.on .pin text{animation:is-pop .35s both;transform-box:fill-box;transform-origin:center}.is .scrn.on .pin :nth-child(n+3){animation-delay:1.4s}.is .scrn.on .pin :nth-child(n+5){animation-delay:2.5s}@keyframes is-draw{from{stroke-dashoffset:1}}
.is .scrn.on .y{animation:is-pop .4s both}.is .scrn.on .pk:nth-of-type(3) .y{animation-delay:.9s}.is .scrn.on .pk:nth-of-type(5) .y{animation-delay:1.6s}
.is .scrn.on .chat div:nth-of-type(1){animation:is-up .4s .8s both}.is .scrn.on .chat div:nth-of-type(2){animation:is-up .4s 1.7s both}
.is .scrn.on .arc{animation:is-arc 1.4s .4s both}@keyframes is-arc{from{stroke-dashoffset:239}}
.is .scrn.on .grid .pick{animation:is-pop .4s .9s both}
.is .scrn.on .crew b{animation:is-pop .4s both}.is .scrn.on .crew b:nth-child(2){animation-delay:.5s}.is .scrn.on .crew b:nth-child(3){animation-delay:.8s}.is .scrn.on .crew b:nth-child(4){animation-delay:1.1s}
@keyframes is-pop{from{transform:scale(.3);opacity:0}}@keyframes is-up{from{transform:translateY(.6em);opacity:0}}
.is .cities{padding:calc(3.4*var(--u)) calc(1.8*var(--u)) calc(1.4*var(--u));line-height:1.75}
.is .city{display:flex;align-items:center;gap:1.2ch}.is .city b{font-weight:500}
.is .city span{margin-left:auto;font-size:calc(1.1*var(--u))}
.is .city i{flex:none;width:.7em;height:.7em;border-radius:50%;border:.16em solid var(--line)}
.is .city.launched span{color:var(--ac);font-weight:700}.is .city.launched i{background:var(--ac);border-color:var(--ac)}
.is .city.next i{border-color:var(--hot);animation:is-ping 1.6s ease-in-out infinite}
.is .city.planned{opacity:.55}
@keyframes is-ping{50%{box-shadow:0 0 0 .35em color-mix(in srgb,var(--hot) 30%,transparent)}}
.scene.is.still *,.scene.is.still *::before,.scene.is.still *::after{transition:none!important;animation:none!important}
@media (max-width:760px){
  .scene.is{display:block;padding:0}
  .scene.is .pn.site{position:absolute;inset:0;border:0;border-radius:0;background:var(--bg)}
  .is .pg{font-size:3.1cqw}
  .is .sec{grid-template-columns:1fr;padding-right:42cqw}.is .sec .c{display:none}
  .is .sec h2{font-size:5.4cqw}.is .sec small{font-size:2.6cqw}.is .sec p{font-size:2.9cqw}
  .is .hero h1{font-size:8cqw}.is .hero p{max-width:26ch}
  .scene.is .pn.app{position:absolute;right:calc(2.5*var(--u));bottom:calc(2.5*var(--u));width:calc(21*var(--u));aspect-ratio:404/644;border:calc(.7*var(--u)) solid var(--line);border-radius:calc(2.6*var(--u));background:color-mix(in srgb,var(--fg) 88%,var(--bg));box-shadow:0 calc(2*var(--u)) calc(5*var(--u)) #0006;transform:rotate(3deg)}
  .is .av{border-radius:calc(2*var(--u))}
  .is .scrn{font-size:min(5cqw,3.2cqh);padding:4cqw}
  .is .cities{display:none}
}
@media (prefers-reduced-motion:reduce){
  .is .pg,.is .scrn{transition:none}
  .is .scrn.on *,.is .city i{animation:none!important}
}
`;

interface View {
  vp: HTMLElement;
  pg: HTMLElement;
  secs: HTMLElement[];
  screens: HTMLElement[];
  site: HTMLElement;
}

let view: View;
/** The index in STOPS the scene is on. */
let at = 0;

/** Put the site and the app at a stop. */
function show(i: number): void {
  at = i;
  const stop = STOPS[i];
  if (!stop) return;
  const { vp, pg, secs, screens } = view;
  const sec = stop.section === null ? null : secs[stop.section];
  const max = Math.max(0, pg.offsetHeight - vp.offsetHeight);
  const top = sec ? sec.offsetTop - 0.03 * vp.offsetWidth : 0;
  pg.style.transform = `translateY(${-Math.min(top, max)}px)`;
  for (const [j, s] of secs.entries())
    s.classList.toggle("at", sec !== null && j === stop.step);
  for (const [j, s] of screens.entries())
    s.classList.toggle("on", j === appStep(stop.step));
}

/**
 * Show a stop at once, with nothing mid-animation. A still frame stays so; a
 * run goes on from it, with the screen's drawing starting afresh.
 */
function jump(kit: Kit, i: number, still: boolean): void {
  kit.root.classList.add("still");
  show(i);
  if (still) return;
  void kit.root.offsetWidth;
  kit.root.classList.remove("still");
}

function build(kit: Kit): void {
  const { root, el } = kit;
  root.classList.add("is");
  const site = kit.pane("site", "site");
  const app = kit.pane("app", "app");
  const cities = kit.pane("launch cities", "cities");

  const vp = el("div", "vp", "", site);
  const pg = el("div", "pg", "", vp);
  pg.innerHTML = `${LOGO}<div class="hero"><h1>Find your people through the things you already love.</h1>
    <p>Tell us what you love. We'll find a few people nearby who love it too, and a time and place to do it together.</p><span class="cta">Join the waitlist</span></div>`;
  const secs = STEPS.map((s, i) => {
    const sec = el("div", "sec", "", pg);
    const text = el("div", "", "", sec);
    el("small", "", s.kicker, text);
    el("h2", "", s.heading, text);
    el("p", "", s.body, text);
    el("div", "c", "", sec).innerHTML = CARDS[i] ?? "";
    return sec;
  });

  const av = el("div", "av", "", app);
  const head = el("div", "apphd", "", av);
  head.innerHTML = `${LOGO}<i></i>`;
  const screens = CARDS.map((card, i) => {
    const screen = el("div", "scrn", "", av);
    screen.dataset.step = String(i);
    el("div", "c", "", screen).innerHTML = card;
    return screen;
  });

  for (const c of CITIES) {
    const row = el("div", `city ${c.state}`, "", cities);
    el("i", "", "", row);
    el("b", "", c.city, row);
    el("span", "", c.label, row);
  }

  view = { vp, pg, secs, screens, site };
  // keep the stop in place when the window is resized or the fonts arrive
  new ResizeObserver(() => show(at)).observe(vp);
  document.fonts?.ready.then(() => show(at));
  kit.focus(site);
  jump(kit, 0, true);
}

async function play(kit: Kit): Promise<void> {
  kit.focus(view.site);
  for (const [i, stop] of STOPS.entries()) {
    if (i === 0) jump(kit, 0, false);
    else show(i);
    await kit.sleep(stop.hold);
  }
}

/** The top of the site with the day screen: the share card's frame. */
function top(kit: Kit): void {
  kit.focus(view.site);
  jump(kit, 0, true);
}

const composition: Composition = {
  css,
  card: "top",
  build,
  play,
  frames: { top },
};

export default composition;
