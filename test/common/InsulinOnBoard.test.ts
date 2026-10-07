/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    insulinOnBoard,
    insulinOnBoardFraction,
    QUICK_ACTING_DURATION,
    QUICK_ACTING_PEAK
} from '../../src/common/InsulinOnBoard.js'

const at = (h: number, m: number) => new Date(2026, 9, 5, h, m)

describe("InsulinOnBoard", () => {

    describe("#insulinOnBoardFraction", () => {
        it("should start at 1 and end at 0", () => {
            expect(insulinOnBoardFraction(0)).to.equal(1)
            expect(insulinOnBoardFraction(-10)).to.equal(1)
            expect(insulinOnBoardFraction(QUICK_ACTING_DURATION)).to.equal(0)
            expect(insulinOnBoardFraction(QUICK_ACTING_DURATION - 1)).to.be.closeTo(0, 0.01)
        })

        it("should decrease over time", () => {
            let previous = 1
            for (let t = 5; t < QUICK_ACTING_DURATION; t += 5) {
                const fraction = insulinOnBoardFraction(t)
                expect(fraction).to.be.below(previous)
                previous = fraction
            }
        })

        it("should fall fastest at the peak of action", () => {
            const drop = (t: number) =>
                insulinOnBoardFraction(t) - insulinOnBoardFraction(t + 1)
            expect(drop(QUICK_ACTING_PEAK)).to.be.above(drop(QUICK_ACTING_PEAK - 40))
            expect(drop(QUICK_ACTING_PEAK)).to.be.above(drop(QUICK_ACTING_PEAK + 40))
        })

        it("should leave about half after 2 hours", () => {
            expect(insulinOnBoardFraction(120)).to.be.within(0.4, 0.6)
        })
    })

    describe("#insulinOnBoard", () => {
        it("should add up the doses taken so far", () => {
            const boluses = [
                { time: at(12, 0), type: "bolus" as const, value: 3 },
                { time: at(13, 0), type: "bolus" as const, value: 3 },
            ]
            expect(insulinOnBoard(boluses, at(12, 0))).to.equal(3)
            const stacked = insulinOnBoard(boluses, at(13, 0))
            expect(stacked).to.be.closeTo(3 + 3 * insulinOnBoardFraction(60), 1e-9)
            expect(insulinOnBoard(boluses, at(11, 0))).to.equal(0)
        })
    })
})
