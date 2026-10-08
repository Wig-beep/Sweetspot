/**
 * Accessibility checks of the manual testing checklist
 * (docs/accessibility-testing.md) that can be done in a browser by a
 * program: keyboard only, visible focus, reflow at 320px, text spacing,
 * high contrast, reduced motion and the structure that screen readers use.
 * Testing with screen readers and with people is still needed.
 */

import { AxeBuilder } from '@axe-core/playwright'
import { expect, Page, test } from '@playwright/test'

/** opens the app with a scenario and a change, and the timeline open */
async function scenarioWithChange(page: Page) {
    // sections open at once, so that checks see them fully open
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/SweetSpot.html')
    await page.getByRole('radio', { name: 'Treating a hypo' }).check()
    const sheet = page.getByRole('button', { name: /^Try a change/ })
    if (await sheet.isVisible()) await sheet.click()
    await page.getByRole('button', { name: 'Too much: 60g', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('With change')
    await page.getByRole('button', { name: 'Edit the day yourself' }).click()
}

test('keyboard only: a scenario and a change, and every stop has a visible focus', async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium' || isMobile, 'Tab reaches every control in Chromium')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/SweetSpot.html')
    await expect(page.getByRole('radio')).toHaveCount(5)

    // the first stop is the skip link
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()

    // choose a scenario with the keyboard: Tab to the radios, arrows to move
    const first = page.getByRole('radio').first()
    for (let i = 0; i < 20 && !(await first.evaluate((e) => e === document.activeElement)); i++) {
        await page.keyboard.press('Tab')
    }
    await expect(first).toBeFocused()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('radio', { name: 'Treating a hypo' })).toBeChecked()
    await expect(page.getByRole('status')).toContainText('Original day')

    // try a change with the keyboard
    const change = page.getByRole('button', { name: 'Too much: 60g', exact: true })
    for (let i = 0; i < 20 && !(await change.evaluate((e) => e === document.activeElement)); i++) {
        await page.keyboard.press('Tab')
    }
    await expect(change).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('With change')

    // every stop to the end of the page shows where the focus is, and the
    // focus never gets stuck
    // from the top of the page: the skip link
    await page.evaluate(() => {
        const skip = document.querySelector<HTMLElement>('.ss-skip-link')!
        skip.focus()
        skip.dataset.tabSeen = '1'
    })
    const stops: string[] = []
    const invisible: string[] = []
    for (let i = 0; i < 250; i++) {
        await page.keyboard.press('Tab')
        const stop = await page.evaluate(() => {
            const e = document.activeElement as HTMLElement | null
            // back at the start, or a stop seen before: the end of the page
            if (!e || e === document.body || e.dataset.tabSeen) return null
            e.dataset.tabSeen = '1'
            const style = getComputedStyle(e)
            const visible = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
                && style.outlineColor !== 'rgba(0, 0, 0, 0)')
                || style.boxShadow !== 'none'
                || style.backgroundColor === 'rgb(255, 235, 59)'
            const name = (e.getAttribute('aria-label') ?? (e.textContent || e.labels?.[0]?.textContent) ?? e.id)
                .trim().replace(/\s+/g, ' ').slice(0, 40)
            return { label: `${e.tagName} "${name}"`, visible }
        })
        if (!stop) break
        stops.push(stop.label)
        if (!stop.visible) invisible.push(stop.label)
    }
    expect(stops.length, stops.join('\n')).toBeGreaterThan(20)
    expect(invisible).toEqual([])
})

test('reflow: nothing scrolls sideways at 320px wide (400% zoom of 1280px)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'set to 320px wide')
    await page.setViewportSize({ width: 320, height: 640 })
    await scenarioWithChange(page)
    await page.getByRole('button', { name: 'Show tools for educators' }).click()
    await page.getByRole('button', { name: 'For educators: make and share a scenario' }).click()
    await page.getByRole('button', { name: 'Start from this day' }).click()
    const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
})

test('text spacing (WCAG 1.4.12): no text cut off or overlapping the page', async ({ page }) => {
    await scenarioWithChange(page)
    // the spacing of WCAG 1.4.12, as in the usual bookmarklets
    await page.addStyleTag({ content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }` })
    const problems = await page.evaluate(() => {
        // text that reaches beyond a container that cuts off its content
        const cut: string[] = []
        for (const box of document.querySelectorAll<HTMLElement>('main *')) {
            const style = getComputedStyle(box)
            if (box.closest('[inert], .visually-hidden, details:not([open])')) continue
            if (style.display === 'none' || style.visibility === 'hidden') continue
            if (!['hidden', 'clip'].includes(style.overflowX) && !['hidden', 'clip'].includes(style.overflowY)) continue
            const edge = box.getBoundingClientRect()
            for (const e of box.querySelectorAll<HTMLElement>('*')) {
                const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())
                if (!hasText || e.closest('.visually-hidden, details:not([open]) > :not(summary)')) continue
                const r = e.getBoundingClientRect()
                if (r.width && (r.bottom > edge.bottom + 1 || r.right > edge.right + 1)) {
                    cut.push(`${e.tagName} "${e.textContent!.trim().slice(0, 30)}"`)
                }
            }
        }
        return {
            cut,
            sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
    })
    expect(problems.sideways).toBeLessThanOrEqual(0)
    expect(problems.cut).toEqual([])
})

test('high contrast (forced colours): no problems, and colours with meaning kept', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced colours can be emulated in Chromium')
    await page.emulateMedia({ forcedColors: 'active' })
    await scenarioWithChange(page)
    // entries scrolled half under the bars at the bottom of a phone screen
    // count as small targets; check from a fixed position
    await page.evaluate(() => window.scrollTo(0, 0))
    const adjust = await page.locator('.tir-bar span').first()
        .evaluate((e) => getComputedStyle(e).forcedColorAdjust)
    expect(adjust).toBe('none')
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
})

test('reduced motion: sections open without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/SweetSpot.html')
    const duration = await page.locator('.accordionbox').first()
        .evaluate((e) => getComputedStyle(e).transitionDuration)
    expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true)
})

test('screen readers: landmarks and headings give the page its structure', async ({ page }) => {
    await scenarioWithChange(page)
    await expect(page.getByRole('banner')).toHaveCount(1)
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('contentinfo')).toHaveCount(1)
    const headings = await page.locator('h1:visible, h2:visible, h3:visible').evaluateAll((list) =>
        list.map((h) => `${h.tagName}: ${(h.textContent ?? '').trim().replace(/\s+/g, ' ')}`))
    expect(headings.slice(0, 3)).toEqual([
        'H1: Practise insulin and food decisions',
        'H2: Choose a day',
        'H3: How to use SweetSpot',
    ])
    expect(headings).toContain('H3: Treating a hypo')
    expect(headings).toContain('H2: What happens to glucose')
    // one h1, and no level skipped from h1 down
    expect(headings.filter((h) => h.startsWith('H1'))).toHaveLength(1)
    // the charts are described for screen readers
    await expect(page.getByRole('img', { name: /^Glucose chart in mmol\/L/ })).toBeAttached()
    await expect(page.getByRole('img', { name: /insulin/i })).toBeAttached()
})
