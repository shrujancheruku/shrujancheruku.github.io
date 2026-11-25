import { defineConfig } from "@playwright/test";

// The end-to-end tests run against the production build, served by `astro preview`.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:4331" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "bunx astro preview --port 4331 --ignore-lock",
    url: "http://localhost:4331/",
    reuseExistingServer: !process.env.CI,
  },
});
