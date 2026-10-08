/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { shortLegendLabel } from '../../src/frontend/util/ResponsiveLegend.js'

describe("shortLegendLabel", () => {
    it("should leave out units, which the axes give", () => {
        expect(shortLegendLabel("Background insulin (units an hour)")).to.equal("Background insulin")
        expect(shortLegendLabel("Original quick-acting insulin (units)")).to.equal("Original quick-acting insulin")
        expect(shortLegendLabel("Original meal (grams of carbs)")).to.equal("Original meal")
    })

    it("should shorten long names", () => {
        expect(shortLegendLabel("Quick-acting insulin on board (units)")).to.equal("Insulin on board")
        expect(shortLegendLabel("Original quick-acting insulin on board (units)")).to.equal("Original insulin on board")
        expect(shortLegendLabel("Background insulin injection (units)")).to.equal("Background injection")
        expect(shortLegendLabel("Original background injection (units)")).to.equal("Original background injection")
    })

    it("should keep the names of changes", () => {
        expect(shortLegendLabel("1 correction, then wait")).to.equal("1 correction, then wait")
        expect(shortLegendLabel("Split dose: 6 + 5 units")).to.equal("Split dose: 6 + 5 units")
    })
})
