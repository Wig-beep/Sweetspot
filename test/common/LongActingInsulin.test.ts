/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    assumedPriorInjections,
    LONG_ACTING_PROFILES,
    longActingRate
} from '../../src/common/LongActingInsulin.js'
import PatientEvent, {
    LONG_ACTING_INSULINS
} from '../../src/types/PatientEvent.js'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m)
const MS_PER_MIN = 60e3

/** integrates the release rate of injections in U over [t0, t1) */
function totalRelease(injections: PatientEvent[], t0: Date, t1: Date) {
    let total = 0
    for (let t = t0.valueOf(); t < t1.valueOf(); t += MS_PER_MIN) {
        for (const injection of injections) {
            total += longActingRate(injection, new Date(t)) / 60
        }
    }
    return total
}

describe("longActingRate", () => {

    for (const insulin of LONG_ACTING_INSULINS) {
        it(`should release the whole dose of ${insulin}`, () => {
            const injection: PatientEvent =
                { time: at(5, 22), type: "longacting", value: 20, insulin }
            const total = totalRelease([injection], at(5, 22), at(8, 0))
            expect(total).to.be.closeTo(20, 0.01)
        })
    }

    it("should release nothing before the injection and after its duration", () => {
        const injection: PatientEvent =
            { time: at(5, 22), type: "longacting", value: 20 }
        const { duration } = LONG_ACTING_PROFILES.glargine
        expect(longActingRate(injection, at(5, 21, 59))).to.equal(0)
        expect(longActingRate(injection, at(5, 22))).to.equal(0)
        expect(longActingRate(injection,
            new Date(at(5, 22).valueOf() + duration * 3600e3))).to.equal(0)
        expect(longActingRate(injection, at(6, 10))).to.be.greaterThan(0)
    })

    it("should give the average daily rate at steady state", () => {
        // a dose of 24 U taken daily releases 1 U/h on average
        for (const insulin of LONG_ACTING_INSULINS) {
            const injections = [1, 2, 3, 4, 5].map((d): PatientEvent =>
                ({ time: at(d, 22), type: "longacting", value: 24, insulin }))
            const total = totalRelease(injections, at(4, 22), at(5, 22))
            expect(total, insulin).to.be.closeTo(24, 0.01)
        }
    })
})

describe("assumedPriorInjections", () => {

    it("should return nothing without injections", () => {
        expect(assumedPriorInjections([])).to.deep.equal([])
    })

    it("should repeat the first day's injections on the preceding days", () => {
        const injections: PatientEvent[] = [
            { time: at(5, 8), type: "longacting", value: 6, insulin: "detemir" },
            { time: at(5, 20), type: "longacting", value: 8, insulin: "detemir" },
            // second day, not repeated
            { time: at(6, 8), type: "longacting", value: 99, insulin: "detemir" },
        ]
        expect(assumedPriorInjections(injections)).to.deep.equal([
            { time: at(4, 8), type: "longacting", value: 6, insulin: "detemir" },
            { time: at(4, 20), type: "longacting", value: 8, insulin: "detemir" },
        ])
    })

    it("should go back as far as the longest acting insulin acts", () => {
        const prior = assumedPriorInjections([
            { time: at(5, 22), type: "longacting", value: 20, insulin: "degludec" },
        ])
        // degludec acts for 42 h, so two earlier days are needed
        expect(prior.map((i) => i.time)).to.deep.equal([at(3, 22), at(4, 22)])
    })
})
