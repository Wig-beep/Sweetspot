/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { computeGlucoseMetrics, modelLimitNote } from '../../src/common/GlucoseMetrics.js'
import { toMgdl } from '../../src/common/GlucoseUnits.js'
import { SimulationResult } from '../../src/types/SimulationResult.js'

const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m)

/** creates a minimal simulation result */
function result(t: Date, mmolL: number, extra: {
    iir?: number, ibolus?: number, meal?: number
} = {}): SimulationResult {
    return <SimulationResult><unknown>{
        t,
        y: { Gp: toMgdl(mmolL) },
        c: { iir: extra.iir, ibolus: extra.ibolus },
        u: { meal: extra.meal ?? 0 },
    }
}

describe("computeGlucoseMetrics", () => {

    it("should weight glucose with the time until the next result", () => {
        // 1 h at 2.5, 1 h at 3.5, 2 h at 6.0 (variable steps), 4 h at 12.0
        const metrics = computeGlucoseMetrics([
            result(at(0), 2.5),
            result(at(1), 3.5),
            result(at(2), 6.0),
            result(at(2, 30), 6.0),
            result(at(4), 12.0),
            result(at(8), 99), // last result has no duration
        ])
        expect(metrics.timeVeryLow).to.be.closeTo(12.5, 1e-9)
        expect(metrics.timeBelowRange).to.be.closeTo(25, 1e-9)
        expect(metrics.timeInRange).to.be.closeTo(25, 1e-9)
        expect(metrics.timeAboveRange).to.be.closeTo(50, 1e-9)
        expect(metrics.meanGlucose).to.be.closeTo(
            (2.5 + 3.5 + 2 * 6 + 4 * 12) / 8, 1e-9)
        expect(metrics.minGlucose).to.be.closeTo(2.5, 1e-9)
        expect(metrics.maxGlucose).to.be.closeTo(99, 1e-9)
    })

    it("should sum insulin and carbs", () => {
        const metrics = computeGlucoseMetrics([
            result(at(0), 6, { iir: 1 }),
            result(at(7, 30), 6, { iir: 1, ibolus: 5, meal: 50 }),
            result(at(7, 31), 6, { iir: 1 }),
            result(at(12), 6, { iir: 0.5, ibolus: 2 }),
            result(at(14), 6, { iir: 0.5 }),
        ])
        expect(metrics.bolusInsulin).to.equal(7)
        expect(metrics.basalInsulin).to.be.closeTo(12 * 1 + 2 * 0.5, 1e-9)
        expect(metrics.carbs).to.equal(50)
    })

    it("should return undefined values without results", () => {
        const metrics = computeGlucoseMetrics([])
        expect(metrics.timeInRange).to.be.NaN
        expect(metrics.meanGlucose).to.be.NaN
        expect(metrics.minGlucose).to.be.NaN
        expect(metrics.bolusInsulin).to.equal(0)
    })
})

describe("modelLimitNote", () => {
    const metricsOf = (min: number, max: number) => computeGlucoseMetrics([
        result(at(0), min), result(at(1), max), result(at(2), 6),
    ])

    it("should say nothing for possible glucose, also severe hypos of the scenarios", () => {
        expect(modelLimitNote(metricsOf(5, 9))).to.be.undefined
        expect(modelLimitNote(metricsOf(1.2, 11.5))).to.be.undefined
    })

    it("should say the model cannot show impossible glucose, and not to read the results", () => {
        for (const note of [modelLimitNote(metricsOf(-0.8, 6)), modelLimitNote(metricsOf(5, 920))]) {
            expect(note).to.contain("the model cannot show what would happen")
            expect(note).to.contain("Do not read anything into these results")
        }
    })
})
