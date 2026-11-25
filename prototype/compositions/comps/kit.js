// PROTOTYPE kit shared by the four compositions.
// ?take=A|B|C framing take · ?theme=<name> · ?card=1 freezes the share-card frame on the paper theme.
// Reduced motion freezes the same frame but keeps the visitor's theme (Motion limits).
export const Q = new URLSearchParams(location.search);
export const isCard = Q.has("card");
export const still = isCard || matchMedia("(prefers-reduced-motion: reduce)").matches;
export const take = ["A", "B", "C"].includes(Q.get("take")) ? Q.get("take") : "A";
// the site's eight themes: background, foreground, accent, dim, line, hot
export const THEMES = {
  "tokyo-night": ["#1a1b26", "#c0caf5", "#7aa2f7", "#24283b", "#414868", "#f7768e"],
  gruvbox: ["#282828", "#d4be98", "#7daea3", "#3c3836", "#504945", "#ea6962"],
  paper: ["#f2eede", "#222222", "#cc3e28", "#d8d3c0", "#bfbaa6", "#cc3e28"],
  "issho-light": ["#F3F5F9", "#131B40", "#885716", "#D5DBE7", "#7A849C", "#CC3719"],
  "issho-dark": ["#0D1330", "#F1F3F8", "#DEA92C", "#222B52", "#6C78AA", "#EB603A"],
  nord: ["#2e3440", "#d8dee9", "#81a1c1", "#3b4252", "#4c566a", "#bf616a"],
  "rose-pine": ["#faf4ed", "#575279", "#56949f", "#f2e9e1", "#cecacd", "#b4637a"],
  starship: ["#1c1c1e", "#f5f5f7", "#ff9f0a", "#2c2c2e", "#8e8e93", "#ff5f4a"],
};
export const LIGHT = ["paper", "issho-light", "rose-pine"];
const subs = [];
export const onTheme = fn => subs.push(fn);
export let theme = "paper";
export function setTheme(n) {
  if (!THEMES[n]) return;
  theme = n;
  const [bg, fg, ac, dim, line, hot] = THEMES[n], s = document.documentElement.style;
  Object.entries({ bg, fg, ac, dim, line, hot }).forEach(([k, v]) => s.setProperty("--" + k, v));
  document.body.classList.toggle("light", LIGHT.includes(n));
  subs.forEach(f => f(n));
}
window.setTheme = setTheme; // the host desktop calls this when the visitor switches theme
document.body.classList.add("t" + take);
document.body.classList.toggle("still", still);
setTheme(isCard ? "paper" : Q.get("theme") || "paper");
export const sleep = ms => (still ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));
export const $ = s => document.querySelector(s);
// types text into el a character at a time, with a block cursor
export async function typeInto(el, text, cps = 28) {
  if (still) { el.textContent = text; return; }
  for (let i = 1; i <= text.length; i++) {
    el.innerHTML = text.slice(0, i).replace(/</g, "&lt;") + '<span class="cur"></span>';
    await sleep(text[i - 1] === "\n" ? 240 : 1000 / cps);
  }
  el.textContent = text;
}
