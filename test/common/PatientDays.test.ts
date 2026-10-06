/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { eventsForDay, getDays } from '../../src/common/PatientDays.js'
import PatientEvent from '../../src/types/PatientEvent.js'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m)

const events: PatientEvent[] = [
    { time: at(6, 7), type: "bolus", value: 5 },
    { time: at(5, 0), type: "basal", value: 0.8 },
    { time: at(5, 22), type: "basal", value: 0.6 },
    { time: at(5, 8), type: "glucose", value: 6.1 },
    { time: at(7, 23, 59), type: "glucose", value: 5.5 },
]

describe("PatientDays", () => {

    it("should list the days with events, in order", () => {
        expect(getDays(events)).to.deep.equal([at(5, 0), at(6, 0), at(7, 0)])
    })

    it("should return the events of a day", () => {
        expect(eventsForDay(events, at(5, 12))).to.deep.equal([
            { time: at(5, 0), type: "basal", value: 0.8 },
            { time: at(5, 8), type: "glucose", value: 6.1 },
            { time: at(5, 22), type: "basal", value: 0.6 },
        ])
    })

    it("should carry the last pump rate over to the start of the day", () => {
        expect(eventsForDay(events, at(6, 0))).to.deep.equal([
            { time: at(6, 0), type: "basal", value: 0.6 },
            { time: at(6, 7), type: "bolus", value: 5 },
        ])
    })
})
