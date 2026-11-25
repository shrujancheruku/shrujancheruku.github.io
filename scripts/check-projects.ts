// First step of `bun run build`: loads the projects so every build failure of
// the spec (src/lib/projects-core.ts) stops the build before it starts.
import { getProjects } from "../src/lib/projects";
import { ProjectsError } from "../src/lib/projects-core";

try {
  const projects = await getProjects();
  console.log(
    `✓ ${projects.length} projects, ${projects.filter((p) => p.featured).length} featured`,
  );
} catch (error) {
  console.error(error instanceof ProjectsError ? error.message : error);
  process.exit(1);
}
