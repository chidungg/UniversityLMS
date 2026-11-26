import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["communication-live.spec.js"],
  workers: 1,
  reporter: "list",
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: "msedge",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node src/scripts/serveCommunicationTest.js",
      cwd: "../backend",
      url: "http://127.0.0.1:5102/api/health",
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      env: { LMS_TEST_API_TARGET: "http://127.0.0.1:5102" },
      reuseExistingServer: true,
    },
  ],
});
