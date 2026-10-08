import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  timeout: 15_000,
  retries: 0,
  workers: 3,
  use: {
    baseURL: "http://127.0.0.1:8080",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev --host 127.0.0.1 --port 8080",
    url: "http://127.0.0.1:8080/tests/ui-harness.html",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
