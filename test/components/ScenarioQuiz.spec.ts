/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Quiz } from '../../src/common/TeachingScenarios.js'
import ScenarioQuiz from '../../src/frontend/LT1Main/ScenarioQuiz.vue'

const quiz: Quiz = {
    question: "Which change avoids the hypo?",
    answers: [
        { text: "Correct three times", correct: false, feedback: "Not quite. The doses add up." },
        { text: "Correct once and wait", correct: true, feedback: "Right. One dose is enough.", whatIf: "1 correction" },
    ],
}

describe("ScenarioQuiz", () => {
    it("asks for an answer before checking", async () => {
        const wrapper = mount(ScenarioQuiz, { props: { quiz }, attachTo: document.body })
        await wrapper.find("form").trigger("submit")
        expect(wrapper.find(".quiz-error").text()).toBe("Error: Choose an answer")
        expect(wrapper.find("fieldset").attributes("aria-describedby")).toMatch(/-error$/)
        wrapper.unmount()
    })

    it("gives feedback on the answer chosen, and shows it on the charts", async () => {
        const wrapper = mount(ScenarioQuiz, { props: { quiz }, attachTo: document.body })
        await wrapper.findAll("input[type=radio]")[0].setValue(true)
        await wrapper.find("form").trigger("submit")
        expect(wrapper.find(".quiz-feedback").text()).toContain("Not quite. The doses add up.")
        expect(wrapper.find(".quiz-feedback").classes()).toContain("is-wrong")
        // the original day, since this answer has no change
        expect(wrapper.find(".quiz-feedback button").text()).toBe("Show the original day")

        await wrapper.findAll("input[type=radio]")[1].setValue(true)
        // a new choice hides the old feedback
        expect(wrapper.find(".quiz-feedback").exists()).toBe(false)
        await wrapper.find("form").trigger("submit")
        expect(wrapper.find(".quiz-feedback").classes()).toContain("is-right")
        await wrapper.find(".quiz-feedback button").trigger("click")
        expect(wrapper.emitted("show")).toEqual([["1 correction"]])
        wrapper.unmount()
    })

    it("starts again for another scenario", async () => {
        const wrapper = mount(ScenarioQuiz, { props: { quiz } })
        await wrapper.findAll("input[type=radio]")[1].setValue(true)
        await wrapper.find("form").trigger("submit")
        await wrapper.setProps({ quiz: { ...quiz, question: "Another question?" } })
        expect(wrapper.find(".quiz-feedback").exists()).toBe(false)
        expect(wrapper.find("legend").text()).toBe("Another question?")
    })
})
