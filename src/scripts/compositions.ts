// Loads the compositions (src/compositions) when the projects workspace gets
// close, and mounts each into its slot. Small on purpose: this is in the first
// load; the compositions and their kit are not.

import { compositions } from "../compositions/registry";
import { shouldLoad } from "../lib/composition-rules";

const area = document.querySelector<HTMLElement>("main.area");
const modelEl = document.getElementById("desktop-model");
if (area && modelEl) {
  const model: { id: string }[] = JSON.parse(modelEl.textContent ?? "[]");
  const projects = model.findIndex((w) => w.id === "projects");
  const slots = [...document.querySelectorAll<HTMLElement>("[data-slot]")];
  const started = new Set<HTMLElement>();
  let loaded = document.readyState === "complete";
  let idle = false;

  const start = (slot: HTMLElement): void => {
    const name = slot.dataset.composition ?? "";
    const load = compositions[name];
    if (!load || started.has(slot)) return;
    started.add(slot);
    Promise.all([load(), import("../compositions/kit")]).then(
      ([{ default: composition }, { mount }]) => mount(slot, composition),
    );
  };

  const check = (): void => {
    const workspace = Number(area.dataset.workspace ?? 0);
    if (!shouldLoad({ workspace, projects, loaded, idle })) return;
    for (const slot of slots) start(slot);
  };

  new MutationObserver(check).observe(area, {
    attributes: true,
    attributeFilter: ["data-workspace"],
  });
  // a slot that comes on show asks for its own composition at once
  for (const slot of slots)
    slot.addEventListener("composition:enter", () => start(slot));

  const afterLoad = (): void => {
    loaded = true;
    const idleCall =
      window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
    idleCall(() => {
      idle = true;
      check();
    });
  };
  if (loaded) afterLoad();
  else addEventListener("load", afterLoad, { once: true });
  check();
}
