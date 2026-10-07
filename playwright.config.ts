import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";
const manageServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";
const managedQa=process.env.GITHUB_ACTIONS==='true' && process.env.BLOXODES_MANAGED_QA==='true';

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "tmp/test-reports/playwright-html", open: "never" }], ["./scripts/quality/playwright-markdown-reporter.ts"]]
    : [["list"], ["html", { outputFolder: "tmp/test-reports/playwright-html", open: "never" }], ["./scripts/quality/playwright-markdown-reporter.ts"]],
  outputDir: "tmp/test-reports/playwright-results",
  use: {
    baseURL,
    launchOptions: managedQa ? {args:['--host-resolver-rules=MAP bloxodes.test 127.0.0.1','--no-proxy-server']} : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: manageServer
    ? {
        command: process.env.GITHUB_ACTIONS === "true" ? "node scripts/ci/start-web.mjs" : "npm run start:web",
        url: `${managedQa?'http://127.0.0.1:3000':baseURL}/api/health?scope=deploy`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe"
      }
    : undefined
});
