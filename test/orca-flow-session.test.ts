import { describe, expect, test } from "bun:test";
import {
  AFTER_QUESTION,
  BEFORE_QUESTION,
  COMMAND,
  clockLabel,
  END_CLOCK_SECONDS,
  endState,
  initialState,
  QUESTION,
  RUN,
  step,
  TICKETS,
} from "../src/compositions/orca-flow-session";

describe("the staged session", () => {
  test("nine tickets, #43 to #51, kept as written", () => {
    expect(TICKETS.map((t) => t.id)).toEqual([
      43, 44, 45, 46, 47, 48, 49, 50, 51,
    ]);
    expect(TICKETS.map((t) => t.title)).toEqual([
      "page titles",
      "theme switch",
      "workspace scroll",
      "contact terminal",
      "project windows",
      "timeline",
      "skill bars",
      "archive window",
      "pages deploy",
    ]);
    expect(COMMAND).toBe("/flow:build #42");
  });

  test("four small, four medium, one large; each routed to its model", () => {
    const count = (size: string) =>
      TICKETS.filter((t) => t.size === size).length;
    expect([count("S"), count("M"), count("L")]).toEqual([4, 4, 1]);
    const model = { S: "haiku", M: "sonnet", L: "opus" } as const;
    for (const t of TICKETS) expect(t.model).toBe(model[t.size]);
  });

  test("the one question is about #50 and is answered with 1 projects workspace", () => {
    expect(QUESTION.ask).toBe(
      "1) #50 opens the archive from the status bar. The spec says only from the projects workspace. Which one?",
    );
    expect(QUESTION.answer).toBe("1 projects workspace");
    expect(QUESTION.answered).toBe(
      "Answered: the archive opens from the projects workspace.",
    );
  });

  test("every ticket is built, checked and merged once, in that order", () => {
    for (const t of TICKETS) {
      const seen = RUN.filter((s) => s.ticket === t.id).map((s) => s.to);
      expect(seen).toEqual(["build", "check", "merged"]);
    }
  });

  test("a ticket waits on you only while the question is open", () => {
    const asked = [...BEFORE_QUESTION, { ticket: 50, to: "waiting" as const }];
    const state = asked.reduce(step, initialState());
    expect(state.status[50]).toBe("waiting");
    expect(state.merged).toBeLessThan(9);
    expect(AFTER_QUESTION[0]).toMatchObject({ ticket: 50, to: "build" });
  });

  test("the end state: 9/9 merged, last merged line, nothing running", () => {
    const end = endState();
    expect(end.merged).toBe(9);
    expect(end.running).toBe(0);
    expect(TICKETS.every((t) => end.status[t.id] === "merged")).toBe(true);
    expect(end.lastMerged).toBe(50);
  });

  test("the run clock reads 38m 12s at the end", () => {
    expect(clockLabel(END_CLOCK_SECONDS)).toBe("38m 12s");
    expect(clockLabel(0)).toBe("0m 00s");
    expect(clockLabel(65)).toBe("1m 05s");
  });

  test("merging a ticket records it as the last merged", () => {
    const state = step(initialState(), { ticket: 43, to: "merged" });
    expect(state.lastMerged).toBe(43);
    expect(state.merged).toBe(1);
  });
});
