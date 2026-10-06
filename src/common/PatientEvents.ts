/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import Meal from '../types/Meal.js'
import PatientEvent, {
    PATIENT_EVENT_TYPES,
    PatientEventType
} from '../types/PatientEvent.js'

/** glucose values above this are assumed to be in mg/dl instead of mmol/L */
const MAX_GLUCOSE_MMOL = 35

/**
 * Parses logged patient events from CSV text.
 *
 * Two layouts are accepted (column order is free, header names are
 * case-insensitive, "start" may be used instead of "time"):
 * - one event per row: `time,type,value[,duration]` with type being one of
 *   basal (U/h), bolus (U), carbs (g) or glucose (mmol/L), and an optional
 *   duration of carb intake in min
 * - legacy layout: `time,basal,bolus,carbs` where each row sets the basal
 *   rate and may contain a bolus and a meal
 *
 * @param {string} csvText - contents of the CSV file
 * @returns {PatientEvent[]} events sorted by time
 * @throws {Error} if the file cannot be parsed; the message names the line
 */
export function parsePatientEventsCSV(csvText: string): PatientEvent[] {
    const lines = csvText.trim().split(/\r?\n/)
    const header = splitRow(lines[0] ?? "").map((name) => name.toLowerCase())
    const column = (...names: string[]) =>
        header.findIndex((name) => names.includes(name))

    const timeCol = column("time", "start")
    if (timeCol < 0) {
        throw new Error('Header must contain a "time" column')
    }
    const typeCol = column("type")
    const valueCol = column("value")
    const durationCol = column("duration")
    const legacyCols = {
        basal: column("basal"),
        bolus: column("bolus"),
        carbs: column("carbs"),
    }
    const isLegacy = typeCol < 0 && Object.values(legacyCols).some((i) => i >= 0)
    if (!isLegacy && (typeCol < 0 || valueCol < 0)) {
        throw new Error('Header must contain "time,type,value" columns '
            + '(or the legacy "time,basal,bolus,carbs")')
    }

    const events: PatientEvent[] = []
    lines.slice(1).forEach((line, index) => {
        if (!line.trim()) {
            return
        }
        const lineNumber = index + 2
        const cells = splitRow(line)
        const fail = (message: string) => {
            throw new Error(`Line ${lineNumber}: ${message}`)
        }

        const time = new Date(cells[timeCol] ?? "")
        if (isNaN(time.valueOf())) {
            fail(`invalid time "${cells[timeCol] ?? ""}"`)
        }
        const readNumber = (col: number, name: string) => {
            const value = Number(cells[col])
            if (!cells[col] || !isFinite(value) || value < 0) {
                fail(`invalid ${name} "${cells[col] ?? ""}"`)
            }
            return value
        }

        if (isLegacy) {
            for (const type of ["basal", "bolus", "carbs"] as const) {
                const col = legacyCols[type]
                if (col < 0 || !cells[col]) {
                    continue
                }
                const value = readNumber(col, type)
                // each legacy row sets the basal rate, even if it is zero
                if (type === "basal" || value > 0) {
                    events.push({ time, type, value })
                }
            }
            return
        }

        const type = (cells[typeCol] ?? "").toLowerCase() as PatientEventType
        if (!PATIENT_EVENT_TYPES.includes(type)) {
            fail(`unknown event type "${cells[typeCol] ?? ""}" (expected `
                + PATIENT_EVENT_TYPES.join(", ") + ")")
        }
        const value = readNumber(valueCol, type)
        if (type === "glucose" && value > MAX_GLUCOSE_MMOL) {
            fail(`glucose ${value} looks like mg/dl, please use mmol/L`)
        }
        const event: PatientEvent = { time, type, value }
        if (type === "carbs" && durationCol >= 0 && cells[durationCol]) {
            event.duration = readNumber(durationCol, "duration")
        }
        events.push(event)
    })

    return sortByTime(events)
}

/**
 * Sorts events by time; events at the same time keep their order.
 * @param {PatientEvent[]} events
 * @returns {PatientEvent[]} new sorted array
 */
export function sortByTime(events: PatientEvent[]): PatientEvent[] {
    return [...events].sort((a, b) => a.time.valueOf() - b.time.valueOf())
}

/**
 * Converts logged carb events into meals for the simulator.
 * @param {PatientEvent[]} events
 * @returns {Meal[]} meals
 */
export function getMealsFromEvents(events: PatientEvent[]): Meal[] {
    return events
        .filter((event) => event.type === "carbs" && event.value > 0)
        .map((event) => ({
            start: event.time,
            carbs: event.value,
            duration: event.duration,
        }))
}

function splitRow(line: string): string[] {
    return line.split(",").map((cell) => cell.trim())
}
