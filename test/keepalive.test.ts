import { describe, expect, test } from "bun:test";
import { shouldKeepAlive } from "../src/lib/keepalive";

const now = new Date("2026-11-26T03:17:00Z");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 86_400_000).toISOString();

describe("keep-alive age rule", () => {
  test("a master whose last commit is 49 days old needs no commit", () => {
    expect(shouldKeepAlive(daysAgo(49), now)).toBe(false);
  });
  test("a master whose last commit is 51 days old gets a commit", () => {
    expect(shouldKeepAlive(daysAgo(51), now)).toBe(true);
  });
  test("exactly 50 days is not yet over 50", () => {
    expect(shouldKeepAlive(daysAgo(50), now)).toBe(false);
  });
  test("an unreadable date fails loudly instead of committing", () => {
    expect(() => shouldKeepAlive("not a date", now)).toThrow();
  });
});
