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
