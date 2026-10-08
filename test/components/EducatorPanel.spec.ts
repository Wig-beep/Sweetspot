/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { decodeScenarioLink } from '../../src/common/ScenarioFiles.js'
import { getTeachingScenarios, TeachingScenario } from '../../src/common/TeachingScenarios.js'
import EducatorPanel from '../../src/frontend/LT1Main/EducatorPanel.vue'
import PatientEvent from '../../src/types/PatientEvent.js'

const scenario = getTeachingScenarios(new Date()).find((s) => s.id === "hypo-treatment")!

function panel(currentEvents: PatientEvent[] | null = null) {
    return mount(EducatorPanel, {
        props: { scenario, originalEvents: scenario.events, currentEvents },
        attachTo: document.body,
    })
}

describe("EducatorPanel", () => {
    it("starts from the scenario shown, with its texts, changes and question", async () => {
        const wrapper = panel()
        await wrapper.find("button").trigger("click")
        expect((wrapper.find("input[id$=-title]").element as HTMLInputElement).value).toBe(scenario.title)
        expect(wrapper.findAll(".educator-change")).toHaveLength(scenario.whatIfs.length)
        expect((wrapper.find("input[id$=-question]").element as HTMLInputElement).value)
            .toBe(scenario.quiz!.question)
        wrapper.unmount()
    })

    it("tries out the scenario written, marked as shared, with the same id each time", async () => {
        const wrapper = panel()
        await wrapper.find("button").trigger("click")
        await wrapper.find("input[id$=-title]").setValue("Hypo after a walk")
        await wrapper.find("form").trigger("submit")
        await wrapper.find("form").trigger("submit")
        const used = wrapper.emitted<[TeachingScenario]>("use")!
        expect(used).toHaveLength(2)
        expect(used[0][0]).toMatchObject({ title: "Hypo after a walk", shared: true })
        expect(used[0][0].id).toBe(used[1][0].id)
        wrapper.unmount()
    })

    it("shows what is wrong, instead of sharing a scenario that cannot be opened", async () => {
        const wrapper = panel()
        await wrapper.find("button").trigger("click")
        await wrapper.find("input[id$=-title]").setValue("")
        await wrapper.find("form").trigger("submit")
        expect(wrapper.find(".educator-error").text()).toBe("Error: The scenario has no title")
        expect(wrapper.emitted("use")).toBeUndefined()
        wrapper.unmount()
    })

    it("adds the change shown, only once", async () => {
        const changed = scenario.whatIfs[0].events.map((e) => ({ ...e, value: e.value + 1 }))
        const wrapper = panel(changed)
        await wrapper.find("button").trigger("click")
        const add = wrapper.findAll("button").find((b) => b.text() === "Add the change shown")!
        expect(add.attributes("disabled")).toBeUndefined()
        await add.trigger("click")
        expect(wrapper.findAll(".educator-change")).toHaveLength(scenario.whatIfs.length + 1)
        expect(add.attributes("disabled")).toBeDefined()
        wrapper.unmount()
    })

    it("copies a link that holds the scenario, without dates", async () => {
        const writeText = vi.fn(async () => undefined)
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
        const wrapper = panel()
        await wrapper.find("button").trigger("click")
        await wrapper.findAll("button").find((b) => b.text() === "Copy a link")!.trigger("click")
        await flushPromises()
        const link = (writeText.mock.calls[0] as unknown as [string])[0]
        expect(link).toMatch(/#scenario=[A-Za-z0-9_-]+$/)
        const file = decodeScenarioLink(link.slice(link.indexOf("#"))) as { title: string }
        expect(file.title).toBe(scenario.title)
        expect(JSON.stringify(file)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
        expect(wrapper.find(".educator-message").text()).toContain("Link copied")
        wrapper.unmount()
    })
})
