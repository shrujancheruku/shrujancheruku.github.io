// Acting mid-motion: what an input does while the windows are still moving. A
// pure rule, no DOM.
//
// An input that leads back to where the running motion began turns it back:
// the motion reverses from where the windows are now, and anything waiting is
// dropped. Turned back, the motion runs to where it began, so a second
// reversal plays it forwards again. Any other input waits until the motion
// ends, then runs from rest; only the latest one is kept. The first
// appearance has no origin to turn back to, so everything during it waits.

/** Where the windows are: a step, its screen (0 on a wide screen), and whether its disclosure is open. */
export interface Where {
  step: number;
  screen: number;
  open: boolean;
}

/** A running motion's two ends; `from` is null for the first appearance. */
export interface Ends {
  from: Where | null;
  to: Where;
}

export type Act = "run" | "turn back" | "wait";

const same = (a: Where, b: Where): boolean =>
  a.step === b.step && a.screen === b.screen && a.open === b.open;

/** What an input leading to `target` does while `running` (null: at rest). */
export function actDuring(running: Ends | null, target: Where): Act {
  if (!running) return "run";
  if (running.from && same(running.from, target)) return "turn back";
  return "wait";
}

/** A motion turned back runs the other way. */
export function turned({ from, to }: Ends): Ends {
  if (!from) throw new Error("the first appearance cannot turn back");
  return { from: to, to: from };
}
