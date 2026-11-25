// Re-records test/fixtures/github-projects.json from the live API with
// your `gh` login. Run by hand, never in the build: bun scripts/record-github.ts
import { buildQuery } from "../src/lib/github";

const names = [
  "issho",
  "unmacos",
  "orca-flow",
  "rapid-radiology",
  "claude-orchestrate",
  "TrueCrypt-Steganography",
  "aidan-landing-page",
  "deleted-example",
];
const query = buildQuery("shrujancheruku", names);
const proc = Bun.spawn(["gh", "api", "graphql", "--field", `query=${query}`], {
  stdout: "pipe",
  stderr: "inherit",
});
const out = await new Response(proc.stdout).text();
await proc.exited;
await Bun.write(
  new URL("../test/fixtures/github-projects.json", import.meta.url),
  `${JSON.stringify(JSON.parse(out), null, 2)}\n`,
);
