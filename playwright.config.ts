import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm --filter @run-walk-coach/shared build && pnpm --dir apps/web exec vite --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
