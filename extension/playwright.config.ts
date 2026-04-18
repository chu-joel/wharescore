import { defineConfig } from "@playwright/test";

// Config scoped to the visual capture run only. Extension's other tests
// (vitest-based extractor tests, api.test.ts) are NOT touched.
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: /capture\.spec\.ts/,
  fullyParallel: false,              // serialise — shared bundle + deterministic out dir naming
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    headless: true,
    launchOptions: { chromiumSandbox: false },
  },
  projects: [
    {
      name: "chromium-visual",
      use: { browserName: "chromium" },
    },
  ],
});
