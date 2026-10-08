/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { GlucoseMetrics } from '../../src/common/GlucoseMetrics.js'
import ScenarioComparison from '../../src/frontend/LT1Main/ScenarioComparison.vue'

const original: GlucoseMetrics = {
    timeInRange: 51.4, timeBelowRange: 33.2, timeVeryLow: 27, timeAboveRange: 15.6,
    meanGlucose: 5.84, minGlucose: 1.21, maxGlucose: 11.52,
    bolusInsulin: 12, basalInsulin: 13.93, carbs: 100,
}
const changed: GlucoseMetrics = {
    ...original, timeInRange: 84.6, timeBelowRange: 0, timeVeryLow: 0,
    minGlucose: 5.01, bolusInsulin: 9,
}

describe("ScenarioComparison", () => {
    it("shows nothing without results", () => {
        expect(mount(ScenarioComparison).find("table").exists()).toBe(false)
    })

    it("compares the original day with the change, in words as well as colours", () => {
        const wrapper = mount(ScenarioComparison, {
            props: { metrics: changed, baseline: original, isLoggedDay: true },
        })
        const headers = wrapper.findAll("thead th").map((th) => th.text())
        expect(headers).toEqual(["", "Original day", "With change", "Difference"])
        const inRange = wrapper.findAll("tbody tr")[0]
        expect(inRange.text()).toContain("Time in range (3.9 to 10mmol/L)")
        expect(inRange.findAll("td").map((td) => td.text())).toEqual(
            ["Time in range (3.9 to 10mmol/L)", "51%", "85%", "+33% better"])
        const low = wrapper.findAll("tbody tr")[1]
        expect(low.find(".improved").text()).toBe("-33% better")
    })

    it("writes units as in NHS content", () => {
        const wrapper = mount(ScenarioComparison, {
            props: { metrics: changed, baseline: original, isLoggedDay: true },
        })
        const cells = wrapper.findAll("tbody td").map((td) => td.text())
        expect(cells).toContain("5.8mmol/L")
        expect(cells).toContain("12.0 units")
        expect(cells).toContain("100g")
    })

    it("shows the time in range bars of both days", () => {
        const wrapper = mount(ScenarioComparison, {
            props: { metrics: changed, baseline: original, isLoggedDay: true },
        })
        const days = wrapper.findAll(".tir-day")
        expect(days.map((d) => d.find("figcaption").text())).toEqual(["Original day", "With change"])
        expect(days[1].text()).toMatch(/In range \(3\.9 to 10\)\s*85%/)
    })
})
