// Plays every typed terminal on the page: each [data-terminal] reads its
// exchanges from its data attribute and renders the timeline from
// src/lib/terminal.ts, frame by frame.
import { type Exchange, type Progress, progressAt } from "../lib/terminal";

function render(
  root: HTMLElement,
  exchanges: readonly Exchange[],
  p: Progress,
) {
  const log = root.querySelector<HTMLElement>(".log");
  const line = root.querySelector<HTMLElement>(".line .typed");
  if (!log || !line) return;

  // the printed lines: every finished command, then its replies
  const printed = exchanges
    .slice(0, p.done)
    .flatMap((e) => [
      { kind: "prompt" as const, text: e.command },
      ...e.replies.map((text) => ({ kind: "reply" as const, text })),
    ]);
  log.replaceChildren(
    ...printed.map(({ kind, text }) => {
      const el = document.createElement("div");
      if (kind === "prompt") {
        el.className = "row";
        const prompt = document.createElement("span");
        prompt.className = "p";
        prompt.textContent = "❯ ";
        el.append(prompt, text);
      } else {
        el.className = "reply";
        el.textContent = text;
      }
      return el;
    }),
  );
  line.textContent = p.typing ? p.typing.text : "";
  root.dataset.typing = p.typing ? String(p.typing.index) : "";
}

for (const root of document.querySelectorAll<HTMLElement>("[data-terminal]")) {
  const exchanges: Exchange[] = JSON.parse(root.dataset.terminal ?? "[]");
  const start = performance.now();
  let last = "";

  const frame = (now: number) => {
    const p = progressAt(exchanges, now - start);
    const key = JSON.stringify(p);
    if (key !== last) {
      last = key;
      render(root, exchanges, p);
    }
    if (p.typing || p.done < exchanges.length) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
