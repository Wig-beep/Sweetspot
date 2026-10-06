/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import {
    checkEvent,
    getExercisesFromEvents,
    getMealsFromEvents,
    parseDateTime,
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

describe("parseDateTime", () => {
    const at = (d: number, h: number, m: number, sec = 0) =>
        new Date(2026, 9, d, h, m, sec)

    it("should read YYYY-MM-DD with a space or T, with or without seconds", () => {
        expect(parseDateTime("2026-10-05 07:30")).to.deep.equal(at(5, 7, 30))
        expect(parseDateTime("2026-10-05T07:30")).to.deep.equal(at(5, 7, 30))
        expect(parseDateTime(" 2026-10-05 7:30:15 ")).to.deep.equal(at(5, 7, 30, 15))
    })

    it("should read UK dates as day/month/year", () => {
        expect(parseDateTime("05/10/2026 08:00")).to.deep.equal(at(5, 8, 0))
        expect(parseDateTime("5/10/2026 08:00")).to.deep.equal(at(5, 8, 0))
    })

    it("should reject dates and times that do not exist", () => {
        expect(parseDateTime("31/02/2026 08:00")).to.be.undefined
        expect(parseDateTime("2026-13-01 08:00")).to.be.undefined
        expect(parseDateTime("2026-10-05 24:00")).to.be.undefined
        expect(parseDateTime("2026-10-05 07:60")).to.be.undefined
    })

    it("should reject other formats instead of guessing", () => {
        for (const text of ["yesterday", "05/10/2026", "10-05-2026 08:00",
            "2026/10/05 08:00", "Oct 5 2026 08:00", ""]) {
            expect(parseDateTime(text), text).to.be.undefined
        }
    })

    it("should be used for CSV files", () => {
        const [event] = parsePatientEventsCSV("time,type,value\n05/10/2026 08:00,bolus,4")
        expect(event.time).to.deep.equal(at(5, 8, 0))
        expect(() => parsePatientEventsCSV("time,type,value\n10-05-2026 08:00,bolus,4"))
            .to.throw(/Line 2: invalid time.*DD\/MM\/YYYY/)
    })
})

describe("checkEvent", () => {
    const time = new Date(2026, 9, 5, 8)

    it("should accept sensible events", () => {
        expect(checkEvent({ time, type: "bolus", value: 4 })).to.be.undefined
        expect(checkEvent({ time, type: "basal", value: 0 })).to.be.undefined
        expect(checkEvent({ time, type: "carbs", value: 50, duration: 15 })).to.be.undefined
    })

    it("should reject impossible values", () => {
        expect(checkEvent({ time, type: "basal", value: -1 })).to.match(/amount must be 0 or more/)
        expect(checkEvent({ time, type: "longacting", value: -16 })).to.match(/amount must be 0 or more/)
        expect(checkEvent({ time, type: "bolus", value: NaN })).to.match(/amount must be 0 or more/)
        expect(checkEvent({ time, type: "glucose", value: 120 })).to.match(/mmol\/L/)
        expect(checkEvent({ time, type: "exercise", value: 150 })).to.match(/at most 100/)
        expect(checkEvent({ time, type: "carbs", value: 50, duration: 0 })).to.match(/duration must be more than 0/)
        expect(checkEvent({ time: new Date(NaN), type: "bolus", value: 1 })).to.match(/time/)
    })
})
