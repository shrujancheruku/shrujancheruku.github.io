// PROTOTYPE kit: ?card=1 freezes a composition in its end state so it can be baked to a share card.
export const card = new URLSearchParams(location.search).has("card");
// Types the first line, then prints the rest a line at a time. lines: [colour, bold, text][]
export function replay(el, lines, { loop = 6000 } = {}) {
  const row = ([c, b, t]) => `<div style="color:${c};font-weight:${b ? 700 : 400}">${t || " "}</div>`;
  if (card) { el.innerHTML = lines.map(row).join(""); return; }
  let li = 0, ci = 0; el.innerHTML = "";
  (function tick() {
    if (li >= lines.length) return void setTimeout(() => replay(el, lines, { loop }), loop);
    const [c, b, t] = lines[li], typed = li === 0;
    if (ci === 0) el.insertAdjacentHTML("beforeend", row([c, b, ""]));
    ci = typed ? ci + 1 : t.length;
    el.lastChild.innerHTML = (t.slice(0, ci) || " ") + (typed && ci < t.length ? '<span class="cur"></span>' : "");
    if (ci >= t.length) { li++; ci = 0; setTimeout(tick, typed ? 600 : t ? 170 : 60); } else setTimeout(tick, 45);
  })();
}
