/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { computeGlucoseMetrics, GlucoseMetrics } from '../../src/common/GlucoseMetrics.js'
import { simulateEvents } from '../../src/common/SimulateEvents.js'
import {
    getTeachingScenarios,
    TeachingScenario
} from '../../src/common/TeachingScenarios.js'
import VirtualPatientUvaPadova from '../../src/core/models/UvaPadova_T1DMS.js'
import IdealCGM from '../../src/core/sensors/IdealCGM.js'
import PatientEvent from '../../src/types/PatientEvent.js'

const day = new Date(2026, 9, 5)
const scenarios = getTeachingScenarios(day)

/** simulates events with the default patient, over the scenario's span */
function simulate(scenario: TeachingScenario, events: PatientEvent[]) {
    const { results, usedExerciseModel } = simulateEvents(events,
        new VirtualPatientUvaPadova(), new IdealCGM(),
        spanOf(scenario))
    return { metrics: computeGlucoseMetrics(results), usedExerciseModel }
}

/** time span covering the logged day and all what-ifs of a scenario */
function spanOf(scenario: TeachingScenario) {
    const all = [scenario.events, ...scenario.whatIfs.map((w) => w.events)].flat()
    const times = all.map((e) => e.time.valueOf())
    return {
        t0: new Date(Math.min(...times)),
        tmax: new Date(Math.max(...times) + 6 * 3600e3),
    }
}

function whatIf(scenario: TeachingScenario, label: string): GlucoseMetrics {
    const w = scenario.whatIfs.find((w) => w.label === label)
    expect(w, label).to.not.be.undefined
    return simulate(scenario, w!.events).metrics
}

function scenario(id: string): TeachingScenario {
    const s = scenarios.find((s) => s.id === id)
    expect(s, id).to.not.be.undefined
    return s!
}

describe("TeachingScenarios", function () {
    this.timeout(30000)

    it("should have unique ids and what-ifs that differ from the logged day", () => {
        expect(new Set(scenarios.map((s) => s.id)).size).to.equal(scenarios.length)
        for (const s of scenarios) {
            expect(s.whatIfs.length, s.id).to.be.greaterThan(0)
            for (const w of s.whatIfs) {
                expect(JSON.stringify(w.events), `${s.id}: ${w.label}`)
                    .to.not.equal(JSON.stringify(s.events))
            }
        }
    })

    it("should simulate a day without exercise with the exercise model if asked", () => {
        // e.g. a what-if that removes the exercise from a day with exercise
        const s = scenario("exercise")
        const withoutExercise = s.events.filter((e) => e.type !== "exercise")
        const patient = new VirtualPatientUvaPadova()
        expect(simulateEvents(withoutExercise, patient, new IdealCGM(), spanOf(s))
            .usedExerciseModel).to.be.false
        expect(simulateEvents(withoutExercise, patient, new IdealCGM(), spanOf(s),
            undefined, true).usedExerciseModel).to.be.true
    })

    // the lessons each scenario is meant to show

    it("bolus timing: injecting before eating lowers the peak, late raises it", () => {
        const s = scenario("bolus-timing")
        const logged = simulate(s, s.events).metrics
        expect(whatIf(s, "20 minutes before eating").maxGlucose)
            .to.be.lessThan(logged.maxGlucose - 0.4)
        expect(whatIf(s, "1 hour after eating").maxGlucose)
            .to.be.greaterThan(logged.maxGlucose + 1)
    })

    it("stacking: repeated corrections cause a hypo, one correction does not", () => {
        const s = scenario("stacking")
        const logged = simulate(s, s.events).metrics
        expect(logged.minGlucose).to.be.lessThan(3)
        expect(whatIf(s, "1 correction, then wait").minGlucose)
            .to.be.greaterThan(4)
    })

    it("high-fat meal: late rise with one dose, split dose avoids both", () => {
        const s = scenario("high-fat-meal")
        const logged = simulate(s, s.events).metrics
        expect(logged.maxGlucose).to.be.greaterThan(12)
        const split = whatIf(s, "split dose: 6 + 5 units")
        expect(split.maxGlucose).to.be.lessThan(logged.maxGlucose - 2)
        expect(split.minGlucose).to.be.greaterThan(4)
        expect(whatIf(s, "11 units all at once").minGlucose).to.be.lessThan(3.9)
    })

    it("exercise: uses the exercise model; usual dose causes a hypo, adjusting prevents it", () => {
        const s = scenario("exercise")
        const logged = simulate(s, s.events)
        expect(logged.usedExerciseModel).to.be.true
        expect(logged.metrics.minGlucose).to.be.lessThan(3.9)
        expect(whatIf(s, "half the insulin and 20g of carbs").minGlucose).to.be.greaterThan(4)
    })

    it("hypo: one 15 g treatment is not enough, repeating it helps, 60 g overshoots", () => {
        const s = scenario("hypo-treatment")
        const logged = simulate(s, s.events).metrics
        const repeated = whatIf(s, "15g, check again, 15g more")
        expect(repeated.timeBelowRange).to.be.lessThan(logged.timeBelowRange / 2)
        expect(whatIf(s, "too much: 60g").maxGlucose)
            .to.be.greaterThan(repeated.maxGlucose + 1.5)
        expect(whatIf(s, "right lunch dose").minGlucose).to.be.greaterThan(4)
    })

    describe("quizzes", () => {
        it("should have one right answer, and changes that exist", () => {
            for (const s of scenarios) {
                expect(s.quiz, s.id).to.not.be.undefined
                const answers = s.quiz!.answers
                expect(answers.filter((a) => a.correct).length, s.id).to.equal(1)
                for (const answer of answers) {
                    if (answer.whatIf) {
                        expect(s.whatIfs.map((w) => w.label), s.id).to.include(answer.whatIf)
                    }
                    expect(answer.feedback, s.id).to.match(answer.correct ? /^Right\./ : /^Not quite\./)
                }
            }
        })

        it("should have as right answer the choice with the most time in range", () => {
            for (const s of scenarios) {
                const tir = s.quiz!.answers.map((answer) => (answer.whatIf
                    ? whatIf(s, answer.whatIf)
                    : simulate(s, s.events).metrics).timeInRange)
                const best = tir.indexOf(Math.max(...tir))
                expect(s.quiz!.answers[best].correct, `${s.id}: ${tir.map((t) => t.toFixed(0))}`)
                    .to.be.true
            }
        })
    })
})
