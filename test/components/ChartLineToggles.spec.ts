/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChartLineToggles from '../../src/frontend/LT1Main/ChartLineToggles.vue'

const lines = [
    { index: 2, text: "Original day", shown: true },
    { index: 3, text: "1 correction, then wait", shown: false },
]

describe("ChartLineToggles", () => {
    it("lists the lines of the legend as checkboxes, as shown or hidden", () => {
        const wrapper = mount(ChartLineToggles, { props: { lines } })
        expect(wrapper.find("summary").text()).toBe("Show or hide lines")
        const boxes = wrapper.findAll("input[type=checkbox]")
        expect(boxes.map((b) => (b.element as HTMLInputElement).checked)).toEqual([true, false])
        expect(wrapper.findAll("label").map((l) => l.text())).toEqual(lines.map((l) => l.text))
        // each checkbox is labelled
        for (const box of boxes) {
            expect(wrapper.find(`label[for="${box.attributes("id")}"]`).exists()).toBe(true)
        }
    })

    it("asks the chart to show or hide a line", async () => {
        const wrapper = mount(ChartLineToggles, { props: { lines } })
        await wrapper.findAll("input[type=checkbox]")[1].trigger("change")
        expect(wrapper.emitted("toggle")).toEqual([[3]])
    })

    it("is not there without lines", () => {
        expect(mount(ChartLineToggles, { props: { lines: [] } }).find("details").exists()).toBe(false)
    })
})
