// The resume's rules, pure: which wording it uses, the drift check against the
// site wording, and the one-page rule. The resume reads src/lib/timeline.ts;
// it never copies it.
import { createHash } from "node:crypto";
import type { Entry } from "./timeline";

/** A short fingerprint of the site wording; line breaks and runs of spaces do not count. */
export const fingerprint = (wording: string): string =>
  createHash("sha256")
    .update(wording.trim().replace(/\s+/g, " "))
    .digest("hex")
    .slice(0, 12);

/** What the resume says for an entry: its own wording, else the site's. */
export const descriptionFor = (entry: Entry): string =>
  entry.resume?.description ?? entry.description;

export interface Drift {
  /** The organisation, else the newest title. */
  entry: string;
  /** The fingerprint the resume wording was written from. */
  recorded: string;
  /** The fingerprint of the site wording now. */
  current: string;
}

/** The entries whose resume wording was written from site wording that has since changed. */
export function driftIn(entries: readonly Entry[]): Drift[] {
  return entries.flatMap((e) => {
    if (!e.resume) return [];
    const current = fingerprint(e.description);
    if (current === e.resume.from) return [];
    return [
      {
        entry: e.organisation ?? e.roles[0]?.title ?? "(unnamed)",
        recorded: e.resume.from,
        current,
      },
    ];
  });
}

/** The resume is one US Letter page; a build that prints more fails. */
export function assertOnePage(pages: number): void {
  if (pages !== 1)
    throw new Error(
      `the resume prints ${pages} pages; it must fit on one (shorten a description with \`resume\` in src/lib/timeline.ts)`,
    );
}
