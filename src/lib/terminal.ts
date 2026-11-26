// The typing timeline of a terminal window: pure, no DOM.
//
// A command is typed one character at a time; after the last character the
// terminal pauses, then the replies come back. Times are in milliseconds from
// the moment typing starts.

/** One command typed at the prompt, and the lines printed under it. */
export interface Exchange {
  command: string;
  replies: readonly string[];
}

/** Time between two typed characters. */
export const TYPE_INTERVAL_MS = 42;

/** Pause between the last typed character and the replies. */
export const SETTLE_MS = 240;

/** The part of a command typed after `elapsed` milliseconds. */
export function typedAt(command: string, elapsed: number): string {
  const chars = Math.min(
    command.length,
    Math.max(0, Math.floor(elapsed / TYPE_INTERVAL_MS)),
  );
  return command.slice(0, chars);
}

/** When the replies to a command start, from the start of typing. */
export function typingEnds(command: string): number {
  return command.length * TYPE_INTERVAL_MS + SETTLE_MS;
}

/** What a terminal shows at a moment: the exchanges finished, and the one being typed. */
export interface Progress {
  /** Exchanges whose replies are printed. */
  done: number;
  /** The exchange being typed, with the characters so far. */
  typing: { index: number; text: string } | null;
}

/** The state of a terminal's exchanges, `elapsed` ms after typing starts. */
export function progressAt(
  exchanges: readonly Exchange[],
  elapsed: number,
): Progress {
  let start = 0;
  for (const [index, exchange] of exchanges.entries()) {
    const end = start + typingEnds(exchange.command);
    if (elapsed < end) {
      return {
        done: index,
        typing: {
          index,
          text: typedAt(exchange.command, elapsed - start),
        },
      };
    }
    start = end;
  }
  return { done: exchanges.length, typing: null };
}
