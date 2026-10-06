/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    getExercisesFromEvents,
    getMealsFromEvents,
    parsePatientEventsCSV
} from '../../src/common/PatientEvents.js'

const at = (h: number, m: number) => new Date(2026, 9, 5, h, m)

describe("parsePatientEventsCSV", () => {

    it("should parse one event per row and sort by time", () => {
        const events = parsePatientEventsCSV([
            "time,type,value,duration",
            "2026-10-05 07:30,carbs,50,20",
            "2026-10-05 07:30,bolus,5,",
            "2026-10-05 00:00,basal,0.8,",
            "",
            "2026-10-05 07:00,Glucose,6.4",
        ].join("\n"))
        expect(events).to.deep.equal([
            { time: at(0, 0), type: "basal", value: 0.8 },
            { time: at(7, 0), type: "glucose", value: 6.4 },
            { time: at(7, 30), type: "carbs", value: 50, duration: 20 },
            { time: at(7, 30), type: "bolus", value: 5 },
        ])
    })

    it("should accept any column order and Windows line endings", () => {
        const events = parsePatientEventsCSV(
            "Value,Type,Time\r\n4,bolus,2026-10-05 12:00\r\n")
        expect(events).to.deep.equal([
            { time: at(12, 0), type: "bolus", value: 4 },
        ])
    })

    it("should parse long-acting injections with insulin names", () => {
        const events = parsePatientEventsCSV([
            "time,type,value,duration,insulin",
            "2026-10-05 22:00,longacting,18,,degludec",
            "2026-10-05 22:00,longacting,18,,Tresiba",
            "2026-10-05 22:00,longacting,18,,",
            "2026-10-05 22:00,bolus,2,,degludec",
        ].join("\n"))
        expect(events).to.deep.equal([
            { time: at(22, 0), type: "longacting", value: 18, insulin: "degludec" },
            { time: at(22, 0), type: "longacting", value: 18, insulin: "degludec" },
            { time: at(22, 0), type: "longacting", value: 18, insulin: "glargine" },
            { time: at(22, 0), type: "bolus", value: 2 },
        ])
    })

    it("should parse exercise with a default duration", () => {
        const events = parsePatientEventsCSV([
            "time,type,value,duration",
            "2026-10-05 14:00,exercise,40,45",
            "2026-10-05 18:00,exercise,20,",
        ].join("\n"))
        expect(events).to.deep.equal([
            { time: at(14, 0), type: "exercise", value: 40, duration: 45 },
            { time: at(18, 0), type: "exercise", value: 20, duration: 30 },
        ])
        expect(getExercisesFromEvents(events)).to.deep.equal([
            { start: at(14, 0), duration: 45, intensity: 40 },
            { start: at(18, 0), duration: 30, intensity: 20 },
        ])
    })

    it("should parse the legacy layout", () => {
        const events = parsePatientEventsCSV([
            "time,basal,bolus,carbs",
            "2026-10-05 08:00,1,0,0",
            "2026-10-05 09:00,0,4,50",
        ].join("\n"))
        expect(events).to.deep.equal([
            { time: at(8, 0), type: "basal", value: 1 },
            { time: at(9, 0), type: "basal", value: 0 },
            { time: at(9, 0), type: "bolus", value: 4 },
            { time: at(9, 0), type: "carbs", value: 50 },
        ])
    })

    const invalid: [string, string, RegExp][] = [
        ["missing time column", "type,value\nbolus,1", /"time" column/],
        ["missing type column", "time,value\n2026-10-05 08:00,1", /time,type,value/],
        ["unknown type", "time,type,value\n2026-10-05 08:00,nph,10",
            /Line 2: unknown event type "nph"/],
        ["unknown insulin", "time,type,value,insulin\n2026-10-05 08:00,longacting,10,nph",
            /Line 2: unknown long-acting insulin "nph"/],
        ["invalid time", "time,type,value\nyesterday,bolus,1", /Line 2: invalid time/],
        ["negative value", "time,type,value\n2026-10-05 08:00,bolus,-1",
            /Line 2: invalid bolus/],
        ["missing value", "time,type,value\n2026-10-05 08:00,bolus,",
            /Line 2: invalid bolus/],
        ["exercise above 100 %", "time,type,value\n2026-10-05 08:00,exercise,150",
            /at most 100 %/],
        ["glucose in mg/dl", "time,type,value\n2026-10-05 08:00,glucose,120",
            /mmol\/L/],
    ]
    for (const [name, csv, message] of invalid) {
        it("should reject " + name, () => {
            expect(() => parsePatientEventsCSV(csv)).to.throw(message)
        })
    }
})

describe("getMealsFromEvents", () => {
    it("should convert carb events into meals", () => {
        const meals = getMealsFromEvents([
            { time: at(7, 30), type: "carbs", value: 50, duration: 20 },
            { time: at(7, 30), type: "bolus", value: 5 },
            { time: at(9, 0), type: "carbs", value: 0 },
            { time: at(12, 0), type: "carbs", value: 40 },
        ])
        expect(meals).to.deep.equal([
            { start: at(7, 30), carbs: 50, duration: 20 },
            { start: at(12, 0), carbs: 40, duration: undefined },
        ])
    })
})
