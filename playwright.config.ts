import { defineConfig } from "@playwright/test";

// The end-to-end tests run against the production build, served by `astro preview`.
// Parallel worktrees can share a machine: E2E_PORT picks another port.
const PORT = process.env.E2E_PORT ?? "4331";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `bunx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
