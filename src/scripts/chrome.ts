// The status bar's right side: the theme menu and T, the crt effect toggle and
// E, the clock, and the shortcut tooltips written out until the first
// interaction. Home and contact (H, C) are handled by the window manager.
import { interpretKey } from "../lib/keys";
import {
  isThemeName,
  loadCrt,
  loadTheme,
  nextTheme,
  saveCrt,
  saveTheme,
  type ThemeName,
} from "../lib/themes";

const root = document.documentElement;
const store = (() => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
})();

const menu = document.getElementById("themes");
const themeButton =
  document.querySelector<HTMLButtonElement>('[data-act="theme"]');
const crtButton = document.querySelector<HTMLButtonElement>('[data-act="crt"]');

let theme: ThemeName = loadTheme(store);
let crt = loadCrt(store);

function showTheme(): void {
  root.dataset.theme = theme;
  for (const el of document.querySelectorAll("[data-theme-name]"))
    el.textContent = theme;
  for (const b of document.querySelectorAll<HTMLElement>("[data-theme-set]"))
    b.setAttribute("aria-checked", String(b.dataset.themeSet === theme));
}

function setTheme(next: ThemeName): void {
  theme = next;
  saveTheme(store, theme);
  showTheme();
}

/** The crt effect itself is drawn by #34; here only its state, memory and the root attribute. */
function showCrt(): void {
  root.dataset.crt = crt ? "on" : "off";
  crtButton?.setAttribute("aria-pressed", String(crt));
  for (const el of document.querySelectorAll("[data-crt-state]"))
    el.textContent = crt ? "on" : "off";
}

function setMenu(open: boolean): void {
  menu?.setAttribute("data-open", String(open));
  themeButton?.setAttribute("aria-expanded", String(open));
}

themeButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  setMenu(menu?.getAttribute("data-open") !== "true");
});
menu?.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-theme-set]");
  const name = b?.dataset.themeSet;
  if (isThemeName(name)) setTheme(name);
});
document.addEventListener("click", (e) => {
  if (!(e.target as Element).closest("#themes")) setMenu(false);
});
crtButton?.addEventListener("click", () => {
  crt = !crt;
  saveCrt(store, crt);
  showCrt();
});

addEventListener("keydown", (e: KeyboardEvent) => {
  const t = e.target;
  if (
    t instanceof HTMLElement &&
    t.matches("input, textarea, select, [contenteditable]")
  )
    return;
  if (e.key === "Escape") return setMenu(false);
  const command = interpretKey(e, 5);
  if (!command || e.repeat) return;
  if (command.type === "theme") setTheme(nextTheme(theme));
  else if (command.type === "crt") {
    crt = !crt;
    saveCrt(store, crt);
    showCrt();
  }
});

// ---- the clock (hidden on touch by CSS)
const clock = document.querySelector("[data-clock]");
const tick = (): void => {
  if (clock)
    clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
};
tick();
setInterval(tick, 10_000);

// ---- until the first interaction the shortcuts are written out
const wake = (): void => {
  document.body.classList.remove("idle");
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"])
    removeEventListener(type, wake, true);
};
for (const type of ["pointerdown", "keydown", "wheel", "touchstart"])
  addEventListener(type, wake, { capture: true, passive: true });

showTheme();
showCrt();
