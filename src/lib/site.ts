// The site's address book, built from the featured projects (#36). Pages call
// this; to add an address (`/archive/`, an archive project) pass `extra`.
import { createAddressBook } from "./addresses";
import { getFeatured } from "./projects";
import { createWorkspaces } from "./workspaces";

export async function getSite() {
  // Reading the projects also fails the build on bad content (#36).
  const featured = await getFeatured();
  const workspaces = createWorkspaces({ featured: featured.length });
  const book = createAddressBook(
    workspaces,
    featured.map((p) => ({ repository: p.repository, pitch: p.pitch })),
  );
  return { featured: featured.length, workspaces, book };
}
