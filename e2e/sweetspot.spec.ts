/**
 * End-to-end tests of the main learner journeys, run against the
 * production build on a desktop and a phone screen (see
 * playwright.config.ts). Elements are found by their accessible names,
 * as learners and assistive technology find them.
 */

import { AxeBuilder } from '@axe-core/playwright'
import { expect, Locator, Page, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const sampleMDI = fileURLToPath(
    new URL('../examples/PatientData/SampleDayMDI.csv', import.meta.url))

/** opens the app and waits until it is ready */
async function open(page: Page) {
    await page.goto('/SweetSpot.html')
    await expect(page.getByRole('radio')).toHaveCount(5)
}

/** the timeline entry whose event is of the given type */
async function timelineRow(page: Page, type: string): Promise<Locator> {
    const rows = page.locator('.timeline-row')
    for (let i = 0; i < await rows.count(); i++) {
        if (await rows.nth(i).getByLabel('Event').inputValue() === type) {
            return rows.nth(i)
        }
    }
    throw new Error(`no timeline entry of type ${type}`)
}

/** uploads a CSV file given as text */
async function upload(page: Page, name: string, text: string) {
    await page.getByLabel('Upload a CSV file').setInputFiles(
        { name, mimeType: 'text/csv', buffer: Buffer.from(text) })
}

/** the WCAG 2.2 AA problems axe finds on the page */
async function accessibilityViolations(page: Page) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    return results.violations.map((v) =>
        `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
}

test.describe('practice scenarios', () => {

    test('choosing a scenario and trying a change updates the results', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Taking correction doses too close together' }).check()

        const status = page.getByRole('status')
        await expect(status).toContainText('Original day: 51% in range, 33% below 3.9')
        await expect(page.getByRole('heading', { name: 'Taking correction doses too close together' }))
            .toBeVisible()

        await page.getByRole('button', { name: '1 correction, then wait' }).click()
        await expect(status).toContainText('With change (1 correction, then wait): 85% in range, 0% below 3.9')

        const summary = page.locator('.scenario-comparison')
        await expect(summary.getByRole('columnheader', { name: 'With change' })).toBeVisible()
        const timeLow = summary.getByRole('row', { name: /Time low/ })
        await expect(timeLow).toContainText('better')

        // the charts describe their content for screen readers
        await expect(page.getByRole('img', { name: /^Glucose chart in mmol\/L\. Original day/ }))
            .toBeAttached()
    })

    test('the timeline is closed for scenarios and opens on request', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        const edit = page.getByRole('button', { name: 'Edit the day yourself' })
        await expect(edit).toHaveAttribute('aria-expanded', 'false')
        await edit.click()
        await expect(edit).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByRole('button', { name: 'Show this change' })).toBeVisible()
    })
})

test.describe('uploaded days', () => {

    test('a CSV file is loaded, and timeline errors are shown before simulating', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a CSV file').setInputFiles(sampleMDI)
        await expect(page.getByText('Using SampleDayMDI.csv')).toBeVisible()
        const status = page.getByRole('status')
        await expect(status).toContainText('Original day:')
        const before = await status.textContent()

        // an impossible amount is reported, and nothing is simulated
        const bolus = await timelineRow(page, 'bolus')
        await bolus.getByLabel('Value').fill('-3')
        await page.getByRole('button', { name: 'Show this change' }).click()
        const problems = page.getByRole('alert').filter({ hasText: 'There is a problem' })
        await expect(problems).toContainText('The amount must be 0 or more')
        await expect(problems).toBeFocused()
        await expect(status).toHaveText(before!)

        // once fixed, the change is compared with the original day
        await bolus.getByLabel('Value').fill('4')
        await page.getByRole('button', { name: 'Show this change' }).click()
        await expect(status).toContainText('With change')
        await expect(page.getByRole('button', { name: 'Undo all changes' })).toBeVisible()
    })

    test('a file that cannot be read gives a clear message', async ({ page }) => {
        await open(page)
        await upload(page, 'bad.csv', 'time,type,value\n2026-10-05 08:00,nph,10\n')
        await expect(page.getByRole('alert')).toContainText(
            'We could not read bad.csv. Line 2: unknown event type "nph"')
    })

    test('UK dates and quoted cells are read correctly', async ({ page }) => {
        await open(page)
        await upload(page, 'uk.csv', '"time","type","value"\n"05/10/2026 08:00","bolus","4"\n')
        await expect(page.getByText(/Showing 8am on Monday 5 October/)).toBeVisible()
    })

    test('a file with several days is looked at one day at a time', async ({ page }) => {
        await open(page)
        const pad = (n: number) => String(n).padStart(2, '0')
        let csv = 'time,type,value\n'
        for (let day = 1; day <= 3; day++) {
            for (let hour = 0; hour < 24; hour++) {
                csv += `2026-10-${pad(day)} ${pad(hour)}:00,glucose,6.0\n`
            }
            csv += `2026-10-${pad(day)} 08:00,bolus,${day}\n`
        }
        await upload(page, 'days.csv', csv)

        const day = page.getByLabel('Day to look at')
        await expect(day.locator('option')).toHaveCount(3)
        await day.selectOption({ label: 'Saturday 3 October' })
        await expect(page.getByText(/Showing 12am on Saturday 3 October/)).toBeVisible()

        // the 24 readings are hidden in the timeline at first
        await page.getByRole('button', { name: 'Edit the day yourself' })
            .evaluate((b) => b.getAttribute('aria-expanded') === 'false' && (<HTMLElement>b).click())
        await expect(page.getByLabel('Show glucose readings (24)')).not.toBeChecked()
        await expect(page.locator('.timeline-row')).toHaveCount(1)
    })
})

test.describe('layout and accessibility', () => {

    test('the page never scrolls sideways', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Exercise after a meal' }).check()
        await page.getByRole('button', { name: 'half the lunch insulin', exact: true }).click()
        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)
    })

    test('ids are unique, so labels and descriptions point to one element', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        const duplicates = await page.evaluate(() => {
            const count = new Map<string, number>()
            document.querySelectorAll('[id]').forEach((e) =>
                count.set(e.id, (count.get(e.id) ?? 0) + 1))
            return [...count].filter(([, n]) => n > 1).map(([id]) => id)
        })
        expect(duplicates).toEqual([])
    })

    test('the start page has no WCAG 2.2 AA problems', async ({ page }) => {
        await open(page)
        expect(await accessibilityViolations(page)).toEqual([])
    })

    test('a scenario with a change has no WCAG 2.2 AA problems', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await page.getByRole('button', { name: 'too much: 60g' }).click()
        // without motion, the section opens at once, so the check sees it
        // fully open rather than half-way through the animation
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.getByRole('button', { name: 'Edit the day yourself' }).click()
        await expect(page.getByRole('status')).toContainText('With change')
        expect(await accessibilityViolations(page)).toEqual([])
    })
})
