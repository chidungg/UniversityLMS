import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', testMatch: ['auth-session.spec.js', 'admin-dashboard-live.spec.js', 'admin-users-live.spec.js', 'admin-courses-live.spec.js', 'admin-enrollments-live.spec.js', 'admin-statistics-live.spec.js', 'instructor-monitoring-live.spec.js'], workers: 1,
  reporter: 'list', timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'msedge', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm --prefix ../backend run dev:auth-test', url: 'http://127.0.0.1:5101/api/health', timeout: 120000, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', env: { LMS_TEST_API_TARGET: 'http://127.0.0.1:5101' }, reuseExistingServer: false },
  ],
})
