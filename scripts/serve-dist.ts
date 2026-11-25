// Serves dist/ the way Pages does (a directory serves its index.html) on a port
// the system picks, so a build never talks to another worktree's server.
import { join } from "node:path";

export const DIST = new URL("../dist/", import.meta.url).pathname;

export function serveDist() {
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      const file = Bun.file(
        join(DIST, pathname.endsWith("/") ? `${pathname}index.html` : pathname),
      );
      return (await file.exists())
        ? new Response(file)
        : new Response("not found", { status: 404 });
    },
  });
}
