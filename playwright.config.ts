import { defineConfig } from "@playwright/test";

// The end-to-end tests run against the production build, served by `astro preview`.
// E2E_PORT lets parallel checkouts use their own server instead of sharing one.
const port = process.env.E2E_PORT ?? "4331";
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `bunx astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
