/**
 * End-to-end tests of the build for clearly educational use, which does not
 * open the learner's own data. Run after building with
 * SWEETSPOT_PERSONAL_DATA=off (see playwright.config.ts).
 */

import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const sampleMDI = fileURLToPath(
    new URL('../examples/PatientData/SampleDayMDI.csv', import.meta.url))

test('own data cannot be opened, scenarios work', async ({ page }, testInfo) => {
    await page.goto('/SweetSpot.html')
    await expect(page.getByRole('group', { name: 'Practice scenario' }).getByRole('radio'))
        .toHaveCount(5)
    await expect(page.getByText('Or use your own day')).toHaveCount(0)
    await expect(page.getByText('This version of SweetSpot does not open your own data'))
        .toBeVisible()

    // a learner's own file is refused
    await page.getByLabel('Open a scenario file').setInputFiles(sampleMDI)
    await expect(page.getByRole('alert')).toContainText(
        'SampleDayMDI.csv is not a scenario file. This version of SweetSpot opens '
        + 'practice scenarios from your educator only')
    await expect(page.getByRole('status')).not.toContainText('Original day')

    // a practice scenario and an educator's scenario file still work
    await page.getByRole('radio', { name: 'Treating a hypo' }).check()
    await expect(page.getByRole('status')).toContainText('Original day:')
    await page.getByRole('button', { name: 'For educators: make and share a scenario' }).click()
    await page.getByRole('button', { name: 'Start from this day' }).click()
    await page.getByLabel('Title').fill('Hypo at school')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save as a file' }).click()
    const path = testInfo.outputPath('scenario.json')
    await (await download).saveAs(path)
    await page.reload()
    await page.getByLabel('Open a scenario file').setInputFiles(path)
    await expect(page.getByRole('radio', { name: /Hypo at school/ })).toBeChecked()
    await expect(page.locator('.own-data-notice')).toHaveCount(0)
})
