import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests of the production build, as learners use it, on a
 * desktop and a phone screen, in Chromium (Chrome, Edge, Android) and WebKit
 * (Safari, iPhone). Run with `npm run test:e2e` (builds first).
 */
/**
 * A build with SWEETSPOT_PERSONAL_DATA=off (no own data, for clearly
 * educational use) is tested with e2e/education-only.spec.ts only.
 */
const educationOnly = process.env.SWEETSPOT_PERSONAL_DATA === 'off'

export default defineConfig({
    testDir: './e2e',
    testMatch: educationOnly ? 'education-only.spec.ts' : 'sweetspot.spec.ts',
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
        // WebKit, the engine of Safari: many learners use iPhones and Macs
        {
            name: 'desktop-safari',
            use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } },
        },
        {
            name: 'iphone',
            use: { ...devices['iPhone 15'] },
        },
    ],
    webServer: {
        command: 'node util/serve-dist.mjs',
        url: 'http://localhost:4173/SweetSpot.html',
        reuseExistingServer: !process.env.CI,
    },
})
