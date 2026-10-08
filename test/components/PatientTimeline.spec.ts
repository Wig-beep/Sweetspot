/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { mount, VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PatientTimeline from '../../src/frontend/LT1Main/PatientTimeline.vue'
import PatientEvent from '../../src/types/PatientEvent.js'

const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m)

const events: PatientEvent[] = [
    { time: at(7, 30), type: "glucose", value: 6.1 },
    { time: at(7, 30), type: "bolus", value: 5 },
    { time: at(7, 30), type: "carbs", value: 50, duration: 15 },
    { time: at(22), type: "longacting", value: 16, insulin: "glargine" },
]

/** the row of the timeline with the given event type */
function row(wrapper: VueWrapper, type: string) {
    return wrapper.findAll(".timeline-row")
        .find((r) => (r.find(".cell-type").element as HTMLSelectElement).value === type)!
}

describe("PatientTimeline", () => {
    it("hides glucose readings at first", async () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        expect(wrapper.findAll(".timeline-row")).toHaveLength(3)
        await wrapper.find("#showGlucose").setValue(true)
        expect(wrapper.findAll(".timeline-row")).toHaveLength(4)
    })

    it("names each field after its entry, for screen readers", () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        const bolus = row(wrapper, "bolus")
        expect(bolus.find(".cell-value").attributes("aria-label")).toBe("07:30 quick-acting insulin: amount")
        expect(bolus.find(".cell-time").attributes("aria-label")).toBe("07:30 quick-acting insulin: time")
        expect(bolus.find(".cell-remove").text()).toBe("Remove 07:30 quick-acting insulin")
        expect(bolus.find(".cell-remove .visually-hidden").text()).toBe("07:30 quick-acting insulin")
    })

    it("emits the changed day, sorted, with all entries", async () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        await row(wrapper, "bolus").find(".cell-value").setValue(6)
        await wrapper.find(".timeline-actions .ss-primary").trigger("click")
        const [changed] = wrapper.emitted<[PatientEvent[]]>("timelineChanged")![0]
        expect(changed).toHaveLength(4)
        expect(changed.find((e) => e.type === "bolus")!.value).toBe(6)
        expect(changed.find((e) => e.type === "longacting")!.insulin).toBe("glargine")
    })

    it("lists problems in an error summary and changes nothing", async () => {
        const wrapper = mount(PatientTimeline, { props: { events }, attachTo: document.body })
        await row(wrapper, "bolus").find(".cell-value").setValue(-3)
        await row(wrapper, "carbs").find(".cell-value").setValue(5000)
        await wrapper.find(".timeline-actions .ss-primary").trigger("click")
        const summary = wrapper.find(".timeline-error-summary")
        expect(summary.attributes("role")).toBe("alert")
        expect(summary.text()).toContain("07:30 quick-acting insulin: The amount must be 0 or more")
        expect(summary.text()).toContain("07:30 carbs: The carbs (grams) must be at most 500")
        // the field with the problem is marked, and described by the message
        const amount = row(wrapper, "bolus").find(".cell-value")
        expect(amount.attributes("aria-invalid")).toBe("true")
        expect(amount.attributes("aria-describedby")).toMatch(/^row-error-/)
        expect(row(wrapper, "bolus").find(".cell-time").attributes("aria-invalid")).toBe("false")
        // the link in the summary moves to that field
        await summary.find("a").trigger("click")
        expect(document.activeElement).toBe(amount.element)
        expect(wrapper.emitted("timelineChanged")).toBeUndefined()
        wrapper.unmount()
    })

    it("marks the duration when it is the problem", async () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        await row(wrapper, "carbs").find(".cell-details input").setValue(5000)
        await wrapper.find(".timeline-actions .ss-primary").trigger("click")
        expect(row(wrapper, "carbs").find(".cell-details input").attributes("aria-invalid")).toBe("true")
        expect(row(wrapper, "carbs").find(".cell-value").attributes("aria-invalid")).toBe("false")
    })

    it("refuses entries more than 3 days apart, e.g. a mistyped year", async () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        await row(wrapper, "bolus").find(".cell-time").setValue("2062-10-05T07:30")
        await wrapper.find(".timeline-actions .ss-primary").trigger("click")
        expect(wrapper.find(".timeline-error-summary").text())
            .toMatch(/The entries are more than 3 days apart .* Check the dates\./)
        expect(wrapper.emitted("timelineChanged")).toBeUndefined()
    })

    it("adds and removes entries", async () => {
        const wrapper = mount(PatientTimeline, { props: { events } })
        await wrapper.findAll(".timeline-actions button")[1].trigger("click")
        expect(wrapper.findAll(".timeline-row")).toHaveLength(4)
        await row(wrapper, "carbs").find(".cell-remove").trigger("click")
        expect(wrapper.findAll(".timeline-row").map((r) =>
            (r.find(".cell-type").element as HTMLSelectElement).value)).not.toContain("carbs")
    })
})
