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

test.describe('safety information', () => {

    test('the footer states the purpose, the version and how to report a problem', async ({ page }) => {
        await open(page)
        const footer = page.locator('footer')
        await expect(footer).toContainText('learning tool for people on structured diabetes education')
        await expect(footer).toContainText('it cannot tell you what dose to take')
        await expect(footer).toContainText(/SweetSpot version \d+\.\d+\.\d+/)
        await expect(footer).toContainText('To report a problem or a safety concern')
    })

    test('nothing is sent anywhere: no requests to other sites', async ({ page }) => {
        const elsewhere: string[] = []
        page.on('request', (request) => {
            const url = new URL(request.url())
            if (!['http:', 'https:'].includes(url.protocol)) return
            if (url.origin !== 'http://localhost:4173') elsewhere.push(request.url())
        })
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.getByRole('status')).toContainText('Original day:')
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await tryChange(page, 'Too much: 60g')
        await expect(page.getByRole('status')).toContainText('With change')
        expect(elsewhere).toEqual([])
    })

    test('scenarios do not show the notice for own data', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await expect(page.getByRole('status')).toContainText('Original day:')
        await expect(page.locator('.own-data-notice')).toHaveCount(0)
    })
})

test.describe('tools for educators', () => {

    test('are hidden for learners, and shown on request or with ?educator', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        const panel = page.getByRole('button', { name: 'For educators: make and share a scenario' })
        const settings = page.getByRole('button', { name: 'Virtual person settings' })
        await expect(panel).toBeHidden()
        await expect(settings).toBeHidden()

        const toggle = page.getByRole('button', { name: 'Show tools for educators' })
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await toggle.click()
        await expect(panel).toBeVisible()
        await expect(settings).toBeVisible()
        await expect(page.getByRole('button', { name: 'Hide tools for educators' }))
            .toHaveAttribute('aria-expanded', 'true')

        // remembered on this device
        await page.reload()
        await expect(page.getByRole('button', { name: 'Hide tools for educators' })).toBeVisible()

        const other = await page.context().browser()!.newPage()
        await other.goto('/SweetSpot.html?educator')
        await expect(other.getByRole('button', { name: 'Hide tools for educators' })).toBeVisible()
        await other.close()
    })
})

test.describe('quizzes', () => {

    test('a quiz gives feedback and shows the answer on the charts', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Taking correction doses too close together' }).check()
        const quiz = page.locator('.scenario-quiz')
        const check = quiz.getByRole('button', { name: 'Check my answer' })

        await check.click()
        await expect(quiz).toContainText('Error: Choose an answer')

        await quiz.getByLabel('Correct twice, at 12pm and 1pm').check()
        await check.click()
        await expect(quiz.locator('.quiz-feedback')).toContainText(/^Not quite\./)
        await expect(quiz.locator('.quiz-feedback')).toBeFocused()

        await quiz.getByLabel('Correct once and give it time to work').check()
        await check.click()
        await expect(quiz.locator('.quiz-feedback')).toContainText(/^Right\./)
        await quiz.getByRole('button', { name: 'Show this change on the charts' }).click()
        await expect(page.getByRole('status')).toContainText('With change (1 correction, then wait)')
    })
})

test.describe('educators', () => {

    /** writes a scenario from the hypo scenario, with a new title */
    async function writeScenario(page: Page) {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await page.getByRole('button', { name: 'Show tools for educators' }).click()
        await page.getByRole('button', { name: 'For educators: make and share a scenario' }).click()
        await page.getByRole('button', { name: 'Start from this day' }).click()
        await page.getByLabel('Title').fill('Hypo after a long walk')
    }

    test('a scenario is tried out and shared as a link', async ({ page, browser }) => {
        await writeScenario(page)
        await page.getByRole('button', { name: 'Try it out' }).click()
        const shared = page.getByRole('radio', { name: /Hypo after a long walk \(shared scenario\)/ })
        await expect(shared).toBeChecked()
        const choices = page.getByRole('group', { name: 'Practice scenario' }).getByRole('radio')
        await expect(choices).toHaveCount(6)
        // trying it out again replaces it rather than adding another
        await page.getByRole('button', { name: 'Try it out' }).click()
        await expect(choices).toHaveCount(6)

        await page.getByRole('button', { name: 'Copy a link' }).click()
        const link = await page.getByLabel('Link to the scenario').inputValue()
        expect(link).toMatch(/SweetSpot\.html#scenario=[A-Za-z0-9_-]+$/)
        expect(link).not.toMatch(/2026|\d{4}-\d{2}-\d{2}/)

        // someone else opens the link
        const other = await browser.newPage()
        await other.goto(link)
        await expect(other.getByRole('radio', { name: /Hypo after a long walk/ })).toBeChecked()
        await expect(other.getByRole('status')).toContainText('Original day:')
        await expect(other.locator('.scenario-quiz')).toContainText('What should you do next?')
        await other.close()
    })

    test('a scenario is saved as a file and opened again', async ({ page, browserName }, testInfo) => {
        await writeScenario(page)
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Save as a file' }).click()
        const file = await download
        expect(file.suggestedFilename()).toBe('sweetspot-scenario-hypo-after-a-long-walk.json')
        const path = testInfo.outputPath(file.suggestedFilename())
        await file.saveAs(path)

        await page.reload()
        await expect(page.getByRole('radio')).toHaveCount(5)
        await page.getByLabel('Upload a file').setInputFiles(path)
        await expect(page.getByRole('radio', { name: /Hypo after a long walk/ })).toBeChecked()
        await expect(page.getByRole('status')).toContainText('Original day:')
    })

    test('a damaged link gives a clear message', async ({ page }) => {
        await page.goto('/SweetSpot.html#scenario=bm90IGpzb24')
        await expect(page.getByRole('alert')).toContainText(
            'We could not open the scenario in this link. The link to this scenario is damaged')
    })

    test('the educator panel has no WCAG 2.2 AA problems', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await writeScenario(page)
        await page.evaluate(() => window.scrollTo(0, 0))
        expect(await accessibilityViolations(page)).toEqual([])
    })

    test('the printed summary shows the scenario and results, not the controls', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await tryChange(page, 'Too much: 60g')
        await expect(page.getByRole('status')).toContainText('With change')
        await page.emulateMedia({ media: 'print' })
        await expect(page.getByRole('heading', { name: 'Treating a hypo' })).toBeVisible()
        await expect(page.locator('.scenario-whatifs')).toBeVisible()
        await expect(page.locator('.tir-days')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Glucose levels' })).toBeVisible()
        for (const hidden of ['.scenario-choice', '.lt1-csv-input', '.scenario-quiz',
            '.whatif-toggle', '.ss-intro']) {
            await expect(page.locator(hidden)).toBeHidden()
        }
        await expect(page.getByRole('button', { name: 'Print a summary' })).toBeHidden()
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
        await expect(page.getByRole('button', { name: 'Too much: 60g' })).toBeHidden()

        await sheet.click()
        await page.getByRole('button', { name: 'Too much: 60g' }).click()
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

test.describe('offline app', () => {

    test('the app can be installed', async ({ page }) => {
        await open(page)
        const href = await page.locator('link[rel=manifest]').getAttribute('href')
        const manifest = await (await page.request.get(href!)).json()
        expect(manifest).toMatchObject({ short_name: 'SweetSpot', display: 'standalone',
            start_url: './SweetSpot.html' })
        for (const icon of manifest.icons) {
            expect((await page.request.get(icon.src)).ok()).toBe(true)
        }
    })

    test('once opened, it works without a connection', async ({ page, context, browserName }) => {
        test.skip(browserName !== 'chromium', 'offline emulation with service workers needs Chromium')
        await open(page)
        // wait until the app is kept on the device and controls the page
        await page.evaluate(async () => {
            await navigator.serviceWorker.ready
            if (!navigator.serviceWorker.controller) {
                await new Promise((resolve) => navigator.serviceWorker
                    .addEventListener('controllerchange', resolve, { once: true }))
            }
        })
        await context.setOffline(true)
        await page.reload()
        await expect(page.getByRole('radio')).toHaveCount(5)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await tryChange(page, 'Too much: 60g')
        await expect(page.getByRole('status')).toContainText('With change')
        await context.setOffline(false)
    })
})

test.describe('uploaded days', () => {

    test('a CSV file is loaded, and timeline errors are shown before simulating', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.getByText('Using SampleDayMDI.csv (SweetSpot CSV file)')).toBeVisible()
        // results of the learner's own data are not a prediction for them
        await expect(page.locator('.lt1-results .own-data-notice'))
            .toContainText('They are not a prediction for you')
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

    test('amounts nobody takes are refused, large ones are questioned', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.locator('.timeline-row').first()).toBeAttached()
        const bolus = await timelineRow(page, 'bolus')
        const show = page.getByRole('button', { name: 'Show this change' })
        const status = page.getByRole('status')

        // 1000 units cannot be right
        await bolus.getByLabel(/: amount$/).fill('1000')
        await show.click()
        await expect(page.getByRole('alert').filter({ hasText: 'There is a problem' }))
            .toContainText('The quick-acting insulin dose (units) must be at most 100')
        await expect(status).not.toContainText('With change')

        // 50 units is allowed, but looks like a typing mistake (5.0)
        await bolus.getByLabel(/: amount$/).fill('50')
        await show.click()
        await expect(status).toContainText('With change')
        const warning = page.locator('.results-warning')
        await expect(warning).toContainText('Check these amounts')
        await expect(warning).toContainText('50 units')
        await expect(warning).toContainText('Check that it is not a typing mistake')
    })

    test('results that are not possible are not presented as results', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.locator('.timeline-row').first()).toBeAttached()
        const bolus = await timelineRow(page, 'bolus')
        await bolus.getByLabel(/: amount$/).fill('100')
        await page.getByRole('button', { name: 'Show this change' }).click()
        await expect(page.getByRole('alert').filter({ hasText: 'the model cannot show what would happen' }))
            .toContainText('Do not read anything into these results')
    })

    test('entries that are too far apart, e.g. a mistyped year, are refused', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.locator('.timeline-row').first()).toBeAttached()
        const bolus = await timelineRow(page, 'bolus')
        await bolus.getByLabel(/: time$/).fill('2062-10-05T07:30')
        await page.getByRole('button', { name: 'Show this change' }).click()
        const problems = page.getByRole('alert').filter({ hasText: 'There is a problem' })
        await expect(problems).toContainText('The entries are more than 3 days apart')
        await expect(problems).toContainText('Check the dates.')
        await expect(problems).toBeFocused()
        await expect(page.getByRole('status')).not.toContainText('With change')
    })

    test('timeline fields are named after their entry, for screen readers', async ({ page }) => {
        await open(page)
        await page.getByLabel('Upload a file').setInputFiles(sampleMDI)
        await expect(page.locator('.timeline-row').first()).toBeAttached()
        const bolus = await timelineRow(page, 'bolus')
        await expect(bolus.getByRole('spinbutton').first())
            .toHaveAccessibleName(/^\d\d:\d\d quick-acting insulin: amount$/)
        const remove = bolus.getByRole('button')
        await expect(remove).toHaveText(/^Remove/)
        await expect(remove).toHaveAccessibleName(/^Remove \d\d:\d\d quick-acting insulin$/)
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
        await tryChange(page, 'Half the lunch insulin')
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

    test('the page has one h1, and a skip link as the first stop', async ({ page }) => {
        await open(page)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practise insulin and food decisions')
        await page.keyboard.press('Tab')
        const skip = page.getByRole('link', { name: 'Skip to main content' })
        // WebKit only moves to links with Tab when the system says so
        test.skip(!(await skip.evaluate((link) => link === document.activeElement)),
            'Tab does not reach links in this browser')
        await expect(skip).toBeVisible()
        await page.keyboard.press('Enter')
        await expect(page.locator('main')).toBeFocused()
    })

    test('the accessibility statement and privacy notice have no WCAG 2.2 AA problems', async ({ page }) => {
        await open(page)
        await page.getByRole('link', { name: 'Accessibility statement' }).click()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accessibility statement for SweetSpot')
        await expect(page.getByText(/partially compliant/)).toBeVisible()
        expect(await accessibilityViolations(page)).toEqual([])
        await page.getByRole('link', { name: 'Privacy' }).click()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy')
        await expect(page.getByText(/does not collect, store or send any personal information/)).toBeVisible()
        expect(await accessibilityViolations(page)).toEqual([])
        await page.getByRole('link', { name: 'Back to SweetSpot' }).click()
        await expect(page.getByRole('radio')).toHaveCount(5)
    })

    test('the start page has no WCAG 2.2 AA problems', async ({ page }) => {
        await open(page)
        expect(await accessibilityViolations(page)).toEqual([])
    })

    test('a scenario with a change has no WCAG 2.2 AA problems', async ({ page }) => {
        await open(page)
        await page.getByRole('radio', { name: 'Treating a hypo' }).check()
        await tryChange(page, 'Too much: 60g')
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
