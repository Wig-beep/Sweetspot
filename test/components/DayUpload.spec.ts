/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { flushPromises, mount, VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scenarioToFile } from '../../src/common/ScenarioFiles.js'
import { getTeachingScenarios } from '../../src/common/TeachingScenarios.js'
import DayUpload from '../../src/frontend/LT1Main/DayUpload.vue'
import PatientEvent from '../../src/types/PatientEvent.js'

/** chooses files in the upload, as a person would */
async function choose(wrapper: VueWrapper, files: { name: string, text: string }[]) {
    const input = wrapper.find("input[type=file]")
    Object.defineProperty(input.element, "files", {
        configurable: true,
        value: files.map((f) => new File([f.text], f.name)),
    })
    await input.trigger("change")
    await flushPromises()
}

const sample = (name: string) => ({
    // tests run from the project folder
    name, text: readFileSync(resolve("examples/PatientData", name), "utf8"),
})

describe("DayUpload", () => {
    it("reads a SweetSpot CSV file and says it shows a made-up person", async () => {
        const wrapper = mount(DayUpload)
        await choose(wrapper, [sample("SampleDayMDI.csv")])
        const [events] = wrapper.emitted<[PatientEvent[]]>("day")![0]
        expect(events.filter((e) => e.type === "bolus")).toHaveLength(3)
        expect(wrapper.text()).toContain("Using SampleDayMDI.csv (SweetSpot CSV file).")
        expect(wrapper.find(".own-data-notice").text()).toContain("They are not a prediction for you")
    })

    it("reads device exports and lists what was assumed", async () => {
        const wrapper = mount(DayUpload)
        await choose(wrapper, [sample("SampleDayLibreView.csv")])
        expect(wrapper.text()).toContain("(LibreView export)")
        expect(wrapper.find(".file-notes").text()).toContain("taken as glargine")
    })

    it("combines Nightscout entries and treatments", async () => {
        const wrapper = mount(DayUpload)
        await choose(wrapper, [sample("SampleDayNightscout-entries.json"),
            sample("SampleDayNightscout-treatments.json")])
        const [events] = wrapper.emitted<[PatientEvent[]]>("day")![0]
        expect(events.some((e) => e.type === "glucose")).toBe(true)
        expect(events.some((e) => e.type === "bolus")).toBe(true)
        expect(wrapper.text()).toContain("(Nightscout download)")
    })

    it("opens a scenario file from an educator", async () => {
        const file = scenarioToFile(getTeachingScenarios(new Date())[0])
        const wrapper = mount(DayUpload)
        await choose(wrapper, [{ name: "scenario.json", text: JSON.stringify(file) }])
        expect(wrapper.emitted("day")).toBeUndefined()
        const [scenario] = wrapper.emitted<[{ title: string, id: string }]>("scenario")![0]
        expect(scenario.title).toBe(file.title)
        expect(scenario.id).toBe("shared-scenario.json")
    })

    it("says clearly what is wrong with a file", async () => {
        const wrapper = mount(DayUpload)
        await choose(wrapper, [{ name: "bad.csv", text: "time,type,value\n2026-10-05 08:00,nph,10\n" }])
        expect(wrapper.find("[role=alert]").text()).toBe(
            'We could not read bad.csv. Line 2: unknown event type "nph" '
            + "(expected basal, bolus, carbs, longacting, exercise, glucose). Check the file and try again.")
        expect(wrapper.emitted("day")).toBeUndefined()
    })

    it("shows files of several days one day at a time", async () => {
        const csv = "time,type,value\n2026-10-01 08:00,bolus,1\n2026-10-02 08:00,bolus,2\n2026-10-03 08:00,bolus,3\n"
        const wrapper = mount(DayUpload)
        await choose(wrapper, [{ name: "days.csv", text: csv }])
        const options = wrapper.findAll("#daySelect option").map((o) => o.text())
        expect(options).toEqual(["Thursday 1 October", "Friday 2 October", "Saturday 3 October"])
        await wrapper.find("#daySelect").setValue("2")
        const days = wrapper.emitted<[PatientEvent[]]>("day")!
        expect(days.at(-1)![0].map((e) => e.value)).toEqual([3])
    })

    it("forgets the files when cleared, e.g. for a practice scenario", async () => {
        const wrapper = mount(DayUpload)
        await choose(wrapper, [sample("SampleDayMDI.csv")])
        ;(wrapper.vm as unknown as { clear(): void }).clear()
        await wrapper.vm.$nextTick()
        expect(wrapper.find(".own-data-notice").exists()).toBe(false)
        expect(wrapper.text()).not.toContain("Using SampleDayMDI.csv")
    })
})
