/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    decodeScenarioLink,
    encodeScenarioLink,
    isScenarioFile,
    ScenarioFile,
    scenarioFromFile,
    scenarioToFile
} from '../../src/common/ScenarioFiles.js'
import { getTeachingScenarios } from '../../src/common/TeachingScenarios.js'

const madeOn = new Date(2026, 9, 5)
const openedOn = new Date(2026, 11, 24)
const scenarios = getTeachingScenarios(madeOn)

/** a copy of the file of the first scenario, to change in tests */
const fileOf = (): ScenarioFile => JSON.parse(JSON.stringify(scenarioToFile(scenarios[1])))

describe("ScenarioFiles", () => {

    it("should keep every built-in scenario, on the day it is opened", () => {
        for (const scenario of scenarios) {
            const file = JSON.parse(JSON.stringify(scenarioToFile(scenario)))
            const opened = scenarioFromFile(file, openedOn, "shared")
            const shift = (t: Date) => t.valueOf() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).valueOf()
            expect(opened.title).to.equal(scenario.title)
            expect(opened.quiz).to.deep.equal(scenario.quiz)
            expect(opened.keyPoints).to.deep.equal(scenario.keyPoints)
            expect(opened.events.map((e) => [shift(e.time), e.type, e.value, e.insulin]))
                .to.deep.equal(scenario.events.map((e) => [shift(e.time), e.type, e.value, e.insulin]))
            expect(opened.events[0].time.getDate()).to.equal(24)
            expect(opened.whatIfs.map((w) => w.events.length))
                .to.deep.equal(scenario.whatIfs.map((w) => w.events.length))
        }
    })

    it("should hold times of day only, and no dates", () => {
        const json = JSON.stringify(scenarioToFile(scenarios[0]))
        expect(json).not.to.match(/\d{4}-\d{2}-\d{2}/)
        expect(json).to.contain('"time":"08:00"')
    })

    it("should keep events after midnight on the next day", () => {
        const file = fileOf()
        file.events.push({ time: "02:00", day: 1, type: "glucose", value: 6 })
        const opened = scenarioFromFile(file, openedOn, "shared")
        expect(opened.events.at(-1)!.time).to.deep.equal(new Date(2026, 11, 25, 2, 0))
        expect(scenarioToFile(opened).events.at(-1)).to.deep.equal(
            { time: "02:00", day: 1, type: "glucose", value: 6 })
    })

    it("should share scenarios as links, also with other characters", () => {
        const file = fileOf()
        file.story = "Pizza – 80g of carbs (8 CP), £5 😀"
        const link = encodeScenarioLink(file)
        expect(link).to.match(/^#scenario=[A-Za-z0-9_-]+$/)
        expect(decodeScenarioLink(link)).to.deep.equal(file)
        expect(decodeScenarioLink("#other")).to.be.undefined
        expect(() => decodeScenarioLink("#scenario=abc")).to.throw("damaged")
    })

    it("should tell scenario files from other files", () => {
        expect(isScenarioFile(fileOf())).to.be.true
        expect(isScenarioFile([{ sgv: 100 }])).to.be.false
        expect(isScenarioFile(null)).to.be.false
    })

    describe("should reject scenarios that are not right", () => {
        const rejects = (change: (file: any) => void, message: string) => {
            const file = fileOf()
            change(file)
            expect(() => scenarioFromFile(file, openedOn, "shared")).to.throw(message)
        }

        it("other files and versions", () => {
            expect(() => scenarioFromFile({ format: "x" }, openedOn, "s"))
                .to.throw("not a SweetSpot scenario")
            rejects((f) => { f.version = 2 }, "different version")
        })

        it("missing or too long texts", () => {
            rejects((f) => { delete f.title }, "no title")
            rejects((f) => { f.title = { html: "<b>" } }, "no title")
            rejects((f) => { f.story = "x".repeat(601) }, "longer than 600")
        })

        it("impossible entries", () => {
            rejects((f) => { f.events[0].value = -2 }, "the amount must be 0 or more")
            rejects((f) => { f.events[0].type = "nph" }, 'unknown type "nph"')
            rejects((f) => { f.events[0].time = "25:00" }, "the time must be HH:MM")
            rejects((f) => { f.events[0].value = "5" }, "must be a number")
            rejects((f) => { f.events = [] }, "have no entries")
        })

        it("questions without one right answer, or with unknown changes", () => {
            rejects((f) => { f.quiz.answers.forEach((a: any) => { a.correct = false }) },
                "one of them right")
            rejects((f) => { f.quiz.answers[1].whatIf = "something else" },
                "not in the scenario")
        })

        it("two changes with the same name", () => {
            rejects((f) => { f.whatIfs[1].label = f.whatIfs[0].label }, "same name")
        })
    })
})
