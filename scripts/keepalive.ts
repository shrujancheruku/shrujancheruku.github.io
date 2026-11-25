// Scheduled keep-alive: writes .github/keepalive.txt only when master has had no
// commit for over 50 days. Prints "commit=true|false" for the workflow to read.
import { appendFileSync, writeFileSync } from "node:fs";
import { shouldKeepAlive } from "../src/lib/keepalive";

const last = Bun.spawnSync(["git", "log", "-1", "--format=%cI", "HEAD"])
  .stdout.toString()
  .trim();
const now = new Date();
const commit = shouldKeepAlive(last, now);

if (commit) {
  writeFileSync(".github/keepalive.txt", `${now.toISOString()}\n`);
}
console.log(`Last commit on master: ${last}; keep-alive commit: ${commit}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `commit=${commit}\n`);
}
