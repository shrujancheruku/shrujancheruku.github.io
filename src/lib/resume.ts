// The resume's rules, pure: which wording it uses, the drift check against the
// site wording, and the one-page rule. The resume reads src/lib/timeline.ts;
// it never copies it.
import { createHash } from "node:crypto";
import {
  type Entry,
  education,
  hobbies,
  languages,
  skillBars,
  skills,
  timeline,
} from "./timeline";

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

export const RESUME_PATH = "/resume/";
export const PDF_PATH = "/shrujan-cheruku-resume.pdf";
export const PDF_TITLE = "Shrujan Cheruku – Resume";
export const PDF_AUTHOR = "Shrujan Cheruku";

export interface Contact {
  label: "Email" | "LinkedIn" | "GitHub" | "Site";
  text: string;
  href: string;
}

const CONTACTS: readonly Contact[] = [
  {
    label: "Email",
    text: "shrujancheruku@gmail.com",
    href: "mailto:shrujancheruku@gmail.com",
  },
  {
    label: "LinkedIn",
    text: "linkedin.com/in/shrujancheruku",
    href: "https://www.linkedin.com/in/shrujancheruku",
  },
  {
    label: "GitHub",
    text: "github.com/shrujancheruku",
    href: "https://github.com/shrujancheruku",
  },
  {
    label: "Site",
    text: "shrujancheruku.github.io",
    href: "https://shrujancheruku.github.io/",
  },
];

/** An entry as the resume shows it: its description already chosen. */
const asResumeEntry = (entry: Entry): Entry => ({
  ...entry,
  description: descriptionFor(entry),
});

/** Everything the resume page shows, read from the shared content. */
export function buildResume() {
  return {
    name: "Shrujan Cheruku",
    title: "Product Engineer",
    contacts: CONTACTS,
    entries: timeline.map(asResumeEntry),
    education: {
      ...education,
      roles: education.roles.map(asResumeEntry),
    },
    bars: skillBars(skills),
    languages,
    hobbies: hobbies.flatMap((folder) => folder.items.map((h) => h.name)),
  };
}
