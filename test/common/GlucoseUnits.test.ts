/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    displayUnit,
    GLUCOSE_RANGE,
    toMgdl,
    toMmolL
} from '../../src/common/GlucoseUnits.js'

describe("GlucoseUnits", () => {

    it("should convert between mg/dl and mmol/L", () => {
        expect(toMmolL(180)).to.be.closeTo(10.0, 0.01)
        expect(toMmolL(70)).to.be.closeTo(3.9, 0.02)
        expect(toMgdl(toMmolL(123))).to.be.closeTo(123, 1e-9)
    })

    it("should match the consensus ranges in mg/dl", () => {
        expect(toMgdl(GLUCOSE_RANGE.veryLow)).to.be.closeTo(54, 0.1)
        expect(toMgdl(GLUCOSE_RANGE.low)).to.be.closeTo(70, 0.5)
        expect(toMgdl(GLUCOSE_RANGE.high)).to.be.closeTo(180, 0.5)
        expect(toMgdl(GLUCOSE_RANGE.veryHigh)).to.be.closeTo(250, 0.5)
    })

    it("should show glucose units in mmol/L", () => {
        expect(displayUnit("mg/dl").unit).to.equal("mmol/L")
        expect(100 * displayUnit("mg/dl").factor).to.be.closeTo(5.55, 0.01)
        expect(displayUnit("(mg/dl)/U").unit).to.equal("(mmol/L)/U")
    })

    it("should leave other units unchanged", () => {
        expect(displayUnit("U/h")).to.deep.equal({ unit: "U/h", factor: 1 })
        expect(displayUnit("")).to.deep.equal({ unit: "", factor: 1 })
    })
})
