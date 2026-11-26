// The address book: every place in the desktop has a path, a title and a
// description. Pure, no DOM. The entry pages are generated from `entries`, and
// the desktop script follows `forStep` / `stepFor` to keep the address bar and
// the tab title in step with what is on screen.
//
// Later tickets add addresses by passing `extra` (for example `/archive/`);
// nothing here changes for them.

import { firstStepOf, locate, stepCount, type Workspace } from "./workspaces";

export const DESCRIPTION = "I design and build. Give me a problem, not a spec.";

const SUFFIX = "Shrujan Cheruku";
export const OPENING_TITLE = `${SUFFIX} — Product Engineer`;
export const notFoundTitle = `Not found — ${SUFFIX}`;
export const titleFor = (place: string): string => `${place} — ${SUFFIX}`;
/** A project's title uses the repository name exactly as written. */
export const titleForProject = (repository: string): string =>
  titleFor(repository);

export interface Address {
  /** Ends in a slash. */
  path: string;
  title: string;
  description: string;
  /** The global step this address opens. */
  step: number;
  /**
   * Set when the address opens the archive window on that step: "" for the
   * window alone, else the repository of the entry it opens on.
   */
  archive?: string;
}

export interface FeaturedProject {
  repository: string;
  pitch: string;
}

/** What the page hands the desktop script: the book as plain data. */
export interface AddressData {
  entries: readonly Address[];
  /** The path shown for each step, indexed by step. */
  byStep: readonly string[];
}

export interface AddressBook {
  /** Every address, one entry page each. */
  entries: readonly Address[];
  data: AddressData;
  /** The address shown while a step is on screen. */
  forStep(step: number): Address;
  /** The address at a path; undefined for an unknown path. */
  forPath(path: string): Address | undefined;
  /** The step an address opens; undefined for an unknown path. */
  stepFor(path: string): number | undefined;
}

const withSlash = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/** The address of a project: its repository name in lower case. */
export const projectPath = (repository: string): string =>
  `/work/${repository.toLowerCase()}/`;

/**
 * The archive's addresses (#38): `/archive/` and one per archive project, all
 * on the last featured project's step with the archive open. None if the
 * archive is empty. Pass the result as `extra` to `createAddressBook`.
 */
export function archiveAddresses(
  workspaces: readonly Workspace[],
  archive: readonly FeaturedProject[],
): Address[] {
  if (archive.length === 0) return [];
  const projects = workspaces.findIndex((w) => w.id === "projects");
  const step =
    firstStepOf(workspaces, projects) +
    (workspaces[projects]?.steps.length ?? 1) -
    1;
  return [
    {
      path: "/archive/",
      title: titleFor("Archive"),
      description: DESCRIPTION,
      step,
      archive: "",
    },
    ...archive.map((p) => ({
      path: projectPath(p.repository),
      title: titleForProject(p.repository),
      description: p.pitch,
      step,
      archive: p.repository,
    })),
  ];
}

/**
 * `featured` are the featured projects in order; project N is step
 * firstStepOf(projects) + N - 1. The first one is `/work/` itself.
 */
export function createAddressBook(
  workspaces: readonly Workspace[],
  featured: readonly FeaturedProject[],
  extra: readonly Address[] = [],
): AddressBook {
  const projects = workspaces.findIndex((w) => w.id === "projects");
  const projectsAt = firstStepOf(workspaces, projects);
  const place = (id: string, path: string, title: string): Address => ({
    path,
    title,
    description: DESCRIPTION,
    step: firstStepOf(
      workspaces,
      workspaces.findIndex((w) => w.id === id),
    ),
  });

  const primary: Address[] = [
    place("opening", "/", OPENING_TITLE),
    place("projects", "/work/", titleFor("Projects")),
    place("timeline", "/timeline/", titleFor("Timeline")),
    place("sabbatical", "/now/", titleFor("Sabbatical")),
    place("contact", "/contact/", titleFor("Contact")),
  ];

  // every featured project has its own step and address, except that the
  // first is also `/work/`: it keeps /work/ as its address for the step, and
  // /work/<slug>/ opens the same step
  const projectEntries: Address[] = featured.map((p, i) => ({
    path: projectPath(p.repository),
    title: titleForProject(p.repository),
    description: p.pitch,
    step: projectsAt + i,
  }));

  const forStepMap = new Map<number, Address>();
  for (const a of primary) forStepMap.set(a.step, a);
  for (const a of projectEntries) {
    if (!forStepMap.has(a.step)) forStepMap.set(a.step, a);
  }

  const entries = [...primary, ...projectEntries, ...extra];
  const steps = stepCount(workspaces);
  const byStep = Array.from({ length: steps }, (_, n) => {
    // a step without an address of its own shows its workspace's address
    const a =
      forStepMap.get(n) ??
      forStepMap.get(firstStepOf(workspaces, locate(workspaces, n).workspace));
    if (!a) throw new RangeError(`no address for step ${n}`);
    return a.path;
  });
  return openAddresses({ entries, byStep });
}

/** The book over plain data (the desktop script uses this). */
export function openAddresses(data: AddressData): AddressBook {
  const byPath = new Map(data.entries.map((a) => [a.path, a]));
  const at = (path: string) => byPath.get(withSlash(path));
  return {
    entries: data.entries,
    data,
    forStep(step) {
      const path = data.byStep[step];
      const found = path === undefined ? undefined : at(path);
      if (!found) throw new RangeError(`no address for step ${step}`);
      return found;
    },
    forPath: at,
    stepFor: (path) => at(path)?.step,
  };
}
