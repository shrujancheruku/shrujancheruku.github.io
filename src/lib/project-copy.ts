// What the projects workspace says about each featured project: the copy
// window and the stack, as plain data. Pure, no DOM. The components only lay
// it out.
import { projectPath } from "./addresses";
import type { Project } from "./projects-core";

export interface Link {
  label: string;
  href: string;
}

export interface Copy {
  /** `featured 2 / 4`. */
  counter: string;
  name: string;
  pitch: string;
  /** Without a trailing full stop. */
  proof: string[];
  /** `repository`, then `live site` when the project has one. */
  links: Link[];
  /** The language and the version line; either may be missing. */
  facts: {
    language: string | null;
    version: { label: string; href: string } | null;
  };
  /** The line under the last featured project that opens the archive. */
  archiveMore: string | null;
  /** The `+N archive` line a phone shows on every project, where it has no stack. */
  archiveOpen: string | null;
}

/** `position` is 1-based among `total` featured projects. */
export function copyOf(
  project: Project,
  position: number,
  total: number,
  archiveCount: number,
): Copy {
  const links: Link[] = [
    { label: "repository", href: project.repositoryUrl },
    ...(project.live ? [{ label: "live site", href: project.live }] : []),
  ];
  return {
    counter: `featured ${position} / ${total}`,
    name: project.name,
    pitch: project.pitch,
    proof: project.proof.map((line) => line.replace(/\.$/, "")),
    links,
    facts: {
      language: project.language,
      version: project.version
        ? { label: project.version.label, href: project.version.url }
        : null,
    },
    archiveMore:
      position === total && archiveCount > 0
        ? `+${archiveCount} more in the archive →`
        : null,
    archiveOpen: archiveCount > 0 ? `+${archiveCount} archive` : null,
  };
}

export interface StackItem {
  name: string;
  /** The project's address; the desktop turns a click into a jump. */
  href: string;
  /** 1-based among the featured. */
  position: number;
}

export interface Stack {
  items: StackItem[];
  /** The closing `+N archive` line, none when the archive is empty. */
  archive: string | null;
}

export function stackOf(
  featured: readonly Project[],
  archiveCount: number,
): Stack {
  return {
    items: featured.map((p, i) => ({
      name: p.name,
      href: projectPath(p.repository),
      position: i + 1,
    })),
    archive: archiveCount > 0 ? `+${archiveCount} archive` : null,
  };
}

export type Fact =
  | { kind: "text"; label: string }
  | { kind: "link"; label: string; href: string };

export interface ArchiveEntry {
  /** The repository as written: the entry's address is `/work/<slug>/`. */
  slug: string;
  name: string;
  /** The repository, which the name links to. */
  href: string;
  /** The release version chip; none if the project has no version. */
  version: string | null;
  pitch: string;
  /** Main language, repository, live; missing parts are left out. */
  facts: Fact[];
}

export interface ArchiveCopy {
  /** `~/archive · 3`. */
  heading: string;
  entries: ArchiveEntry[];
}

/** What the archive window says: no image, no year. */
export function archiveOf(archive: readonly Project[]): ArchiveCopy {
  return {
    heading: `~/archive · ${archive.length}`,
    entries: archive.map((p) => ({
      slug: p.repository,
      name: p.name,
      href: p.repositoryUrl,
      version: p.version?.label ?? null,
      pitch: p.pitch,
      facts: [
        ...(p.language ? [{ kind: "text" as const, label: p.language }] : []),
        { kind: "link", label: "repository ↗", href: p.repositoryUrl },
        ...(p.live
          ? [{ kind: "link" as const, label: "live ↗", href: p.live }]
          : []),
      ],
    })),
  };
}
