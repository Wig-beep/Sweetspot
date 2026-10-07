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

/**
 * tries a change of the loaded scenario; on phones, the changes are in a
 * sheet at the bottom of the screen, which is opened first
 */
async function tryChange(page: Page, name: string) {
    const sheet = page.getByRole('button', { name: /^Try a change/ })
    if (await sheet.isVisible() && await sheet.getAttribute('aria-expanded') === 'false') {
        await sheet.click()
    }
    await page.getByRole('button', { name, exact: true }).click()
}

/** the timeline entry whose event is of the given type */
async function timelineRow(page: Page, type: string): Promise<Locator> {
    const rows = page.locator('.timeline-row')
    for (let i = 0; i < await rows.count(); i++) {
        if (await rows.nth(i).getByLabel(/: event$/).inputValue() === type) {
            return rows.nth(i)
        }
    }
    throw new Error(`no timeline entry of type ${type}`)
}

/** uploads a CSV file given as text */
async function upload(page: Page, name: string, text: string) {
    await page.getByLabel('Upload a file').setInputFiles(
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

        await tryChange(page, '1 correction, then wait')
        await expect(status).toContainText('With change (1 correction, then wait): 85% in range, 0% below 3.9')

        const summary = page.locator('.scenario-comparison')
        await expect(summary.getByRole('columnheader', { name: 'With change' })).toBeVisible()
        const timeLow = summary.getByRole('row', { name: /Time low/ })
        await expect(timeLow).toContainText('better')

        // time in range of both days, as bars with their percentages
        const bars = summary.locator('..').locator('.tir-day')
        await expect(bars).toHaveCount(2)
        await expect(bars.nth(0)).toContainText('Original day')
        await expect(bars.nth(1)).toContainText(/With change.*In range \(3\.9 to 10\)\s*85%/s)

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

test.describe('first visit and phones', () => {

    test('the introduction can be hidden, and stays hidden', async ({ page }) => {
        await open(page)
        const intro = page.getByRole('region', { name: 'How to use SweetSpot' })
        await expect(intro).toContainText('Pick a scenario')
        await page.getByRole('button', { name: 'Hide this introduction' }).click()
        await expect(intro).toHaveCount(0)
        const link = page.getByRole('link', { name: 'How to use SweetSpot' })
        await expect(link).toBeFocused()

        await page.reload()
        await expect(page.getByRole('radio')).toHaveCount(5)
        await expect(intro).toHaveCount(0)
        await link.click()
        await expect(intro).toBeVisible()
    })

    test('on phones, changes are tried from a sheet that keeps the charts in view', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'the sheet is only used on phones')
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        const sheet = page.getByRole('button', { name: /^Try a change/ })
        await expect(sheet).toHaveAttribute('aria-expanded', 'false')
        await expect(page.getByRole('button', { name: 'too much: 60g' })).toBeHidden()

        await sheet.click()
        await page.getByRole('button', { name: 'too much: 60g' }).click()
        // the sheet closes, keeps the focus, and the charts are shown
        await expect(sheet).toHaveAttribute('aria-expanded', 'false')
        await expect(sheet).toBeFocused()
        await expect(page.getByRole('status')).toContainText('With change')
        await expect(page.getByRole('heading', { name: 'What happens to glucose' })).toBeInViewport()
    })

    test('glucose readings are hidden in the timeline at first', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Taking correction doses too close together' }).check()
        await page.getByRole('button', { name: 'Edit the day yourself' }).click()
        const show = page.getByLabel(/Show glucose readings/)
        await expect(show).not.toBeChecked()
        const rows = page.locator('.timeline-row')
        const withoutReadings = await rows.count()
        await show.check()
        await expect(rows).not.toHaveCount(withoutReadings)
    })
})

test.describe('uploaded days', () => {

    test('a CSV file is loaded, and timeline errors are shown before simulating', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.getByText('Using SampleDayMDI.csv (SweetSpot CSV file)')).toBeVisible()
        const status = page.getByRole('status')
        await expect(status).toContainText('Original day:')
        const before = await status.textContent()

        // an impossible amount is reported, and nothing is simulated
        const bolus = await timelineRow(page, 'bolus')
        await bolus.getByLabel(/: amount$/).fill('-3')
        await page.getByRole('button', { name: 'Show this change' }).click()
        const problems = page.getByRole('alert').filter({ hasText: 'There is a problem' })
        await expect(problems).toContainText('The amount must be 0 or more')
        await expect(problems).toBeFocused()
        await expect(status).toHaveText(before!)

        // once fixed, the change is compared with the original day
        await bolus.getByLabel(/: amount$/).fill('4')
        await page.getByRole('button', { name: 'Show this change' }).click()
        await expect(status).toContainText('With change')
        await expect(page.getByRole('button', { name: 'Undo all changes' })).toBeVisible()
    })

    test('timeline fields are named after their entry, for screen readers', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.locator('.timeline-row').first()).toBeAttached()
        const bolus = await timelineRow(page, 'bolus')
        await expect(bolus.getByRole('spinbutton').first())
            .toHaveAccessibleName(/^\d\d:\d\d quick-acting insulin: amount$/)
        await expect(bolus.getByRole('button')).toHaveAccessibleName(
            /^Remove \d\d:\d\d quick-acting insulin$/)
        const names = await page.locator('.timeline-row .cell-value').evaluateAll(
            (inputs) => inputs.map((input) => input.getAttribute('aria-label')))
        expect(new Set(names).size).toBe(names.length)
    })

    test('a file that cannot be read gives a clear message', async ({ page }) => {
        await open(page)
        await upload(page, 'bad.csv', 'time,type,value\n2026-10-05 08:00,nph,10\n')
        await expect(page.getByRole('alert')).toContainText(
            'We could not read bad.csv. Line 2: unknown event type "nph"')
    })

    test('a Dexcom Clarity export is read, saying what was not used', async ({ page }) => {
        await open(page)
        await upload(page, 'clarity.csv', [
            'Index,Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Event Subtype,Patient Info,'
                + 'Device Info,Source Device ID,Glucose Value (mmol/L),Insulin Value (u),'
                + 'Carb Value (grams),Duration (hh:mm:ss)',
            '1,,FirstName,,A,,,,,,',
            '2,2026-10-05T07:00:00,EGV,,,,,6.2,,,',
            '3,2026-10-05T07:30:00,Insulin,Fast-Acting,,,,,5,,',
            '4,2026-10-05T07:30:00,Carbs,,,,,,,45,',
            '5,2026-10-05T09:00:00,Alert,High,,,,,,,',
        ].join('\n'))
        await expect(page.getByText('Using clarity.csv (Dexcom Clarity export).')).toBeVisible()
        await expect(page.getByText('1 other entries (such as alert) were not used.')).toBeVisible()
        await expect(page.getByRole('status')).toContainText('Original day:')
    })

    test('the LibreView sample file is read', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(fileURLToPath(
            new URL('../examples/PatientData/SampleDayLibreView.csv', import.meta.url)))
        await expect(page.getByText('Using SampleDayLibreView.csv (LibreView export).')).toBeVisible()
        await expect(page.getByText(/taken as glargine/)).toBeVisible()
        await expect(page.getByRole('status')).toContainText('Original day:')
    })

    test('Nightscout entries and treatments are read together', async ({ page }) => {
        await open(page)
        const at = (h: number) => new Date(2026, 9, 5, h).toISOString()
        await page.getByLabel('Upload a file').setInputFiles([
            { name: 'entries.json', mimeType: 'application/json', buffer: Buffer.from(
                JSON.stringify([{ type: 'sgv', sgv: 110, dateString: at(7) }])) },
            { name: 'treatments.json', mimeType: 'application/json', buffer: Buffer.from(
                JSON.stringify([{ eventType: 'Meal Bolus', created_at: at(8), insulin: 5, carbs: 45 }])) },
        ])
        await expect(page.getByText('Using entries.json, treatments.json (Nightscout download).'))
            .toBeVisible()
        await expect(page.getByRole('status')).toContainText('Original day:')
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
        await tryChange(page, 'half the lunch insulin')
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
        await tryChange(page, 'too much: 60g')
        // without motion, the section opens at once, so the check sees it
        // fully open rather than half-way through the animation
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.getByRole('button', { name: 'Edit the day yourself' }).click()
        await expect(page.getByRole('status')).toContainText('With change')
        // on phones, entries scrolled half under the bars at the bottom of
        // the screen count as small targets; check from a fixed position
        await page.evaluate(() => window.scrollTo(0, 0))
        expect(await accessibilityViolations(page)).toEqual([])
    })
})
