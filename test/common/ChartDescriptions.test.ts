/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { describeGlucose, describeInsulin } from '../../src/common/ChartDescriptions.js'
import { GlucoseMetrics } from '../../src/common/GlucoseMetrics.js'

const metrics: GlucoseMetrics = {
    timeInRange: 51.4, timeBelowRange: 33.2, timeVeryLow: 27, timeAboveRange: 15.6,
    meanGlucose: 6.04, minGlucose: 1.31, maxGlucose: 11.52,
    bolusInsulin: 12, basalInsulin: 13.93, carbs: 100,
}

describe("ChartDescriptions", () => {

    it("should describe glucose of each day", () => {
        expect(describeGlucose([
            { name: "Original day", metrics },
            { name: "With change (1 correction)", metrics: { ...metrics, minGlucose: 5.1 } },
        ])).to.equal("Glucose chart in mmol/L. "
            + "Original day: 51% of the time in range (3.9 to 10), 33% low (below 3.9), "
            + "16% high (above 10). Lowest 1.3, highest 11.5, average 6.0. "
            + "With change (1 correction): 51% of the time in range (3.9 to 10), "
            + "33% low (below 3.9), 16% high (above 10). Lowest 5.1, highest 11.5, average 6.0.")
    })

    it("should describe insulin and carbs", () => {
        expect(describeInsulin([{ name: "Original day", metrics }])).to.equal(
            "Insulin and food chart. Original day: 12.0 units of quick-acting insulin, "
            + "13.9 units of background insulin, 100g of carbs.")
    })

    it("should say when nothing has been simulated", () => {
        expect(describeGlucose([])).to.match(/no results yet/)
        expect(describeInsulin([])).to.match(/no results yet/)
    })
})
