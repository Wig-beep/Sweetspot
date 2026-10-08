/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { checkTimeSpan, getPatientDataTimeSpan } from '../../src/common/PatientDataTimeSpan.js'

const at = (d: number, h: number, m: number, s = 0) =>
    new Date(2026, 8, d, h, m, s)

describe("getPatientDataTimeSpan", () => {

    it("should span from the first to 6 h after the last event", () => {
        const span = getPatientDataTimeSpan([
            { time: at(14, 12, 0), type: "bolus", value: 2 },
            { time: at(14, 8, 0), type: "basal", value: 1 },
            { time: at(14, 19, 0), type: "carbs", value: 60 },
        ])
        expect(span).to.deep.equal({ t0: at(14, 8, 0), tmax: at(15, 1, 0) })
    })

    it("should cover several days and use a custom tail", () => {
        const span = getPatientDataTimeSpan([
            { time: at(14, 7, 30), type: "basal", value: 1 },
            { time: at(16, 18, 0), type: "glucose", value: 6.2 },
        ], 2)
        expect(span).to.deep.equal({ t0: at(14, 7, 30), tmax: at(16, 20, 0) })
    })

    it("should round the start down to the full minute", () => {
        const span = getPatientDataTimeSpan(
            [{ time: at(14, 7, 30, 45), type: "basal", value: 1 }])
        expect(span?.t0).to.deep.equal(at(14, 7, 30))
    })

    it("should return undefined without events", () => {
        expect(getPatientDataTimeSpan([])).to.be.undefined
    })

    describe("checkTimeSpan", () => {
        const at = (day: number, h: number) => new Date(2026, 9, day, h)

        it("should accept up to 3 days between the entries", () => {
            expect(checkTimeSpan([])).to.be.undefined
            expect(checkTimeSpan([{ time: at(5, 8), type: "bolus", value: 5 }])).to.be.undefined
            expect(checkTimeSpan([
                { time: at(5, 8), type: "bolus", value: 5 },
                { time: at(8, 8), type: "bolus", value: 5 },
            ])).to.be.undefined
        })

        it("should name the dates when entries are further apart, e.g. a mistyped year", () => {
            const problem = checkTimeSpan([
                { time: at(5, 8), type: "bolus", value: 5 },
                { time: new Date(2062, 9, 5, 8), type: "bolus", value: 5 },
            ])
            expect(problem).to.match(/more than 3 days apart \(from Monday 5 October 2026 to .* 2062\)/)
            expect(problem).to.match(/Check the dates$/)
        })
    })
})
