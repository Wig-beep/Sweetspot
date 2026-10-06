import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests of the production build, as learners use it, on a
 * desktop and a phone screen. Run with `npm run test:e2e` (builds first).
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
        },
        {
            name: 'phone',
            use: { ...devices['Pixel 7'] },
        },
    ],
    webServer: {
        command: 'node util/serve-dist.mjs',
        url: 'http://localhost:4173/SweetSpot.html',
        reuseExistingServer: !process.env.CI,
    },
})
