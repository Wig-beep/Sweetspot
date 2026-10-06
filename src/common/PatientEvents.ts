/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { DEFAULT_LONG_ACTING_INSULIN } from './LongActingInsulin.js'
import Exercise from '../types/Exercise.js'
import Meal from '../types/Meal.js'
import PatientEvent, {
    LONG_ACTING_INSULINS,
    LongActingInsulin,
    PATIENT_EVENT_TYPES,
    PatientEventType
} from '../types/PatientEvent.js'

/** glucose values above this are assumed to be in mg/dl instead of mmol/L */
const MAX_GLUCOSE_MMOL = 35

/** duration of exercise in min, if none is given */
export const DEFAULT_EXERCISE_DURATION = 30

/** brand names accepted for long-acting insulins */
const LONG_ACTING_BRANDS: Record<string, LongActingInsulin> = {
    lantus: "glargine",
    abasaglar: "glargine",
    semglee: "glargine",
    toujeo: "glargine_u300",
    tresiba: "degludec",
    levemir: "detemir",
}

/**
 * Parses logged patient events from CSV text.
 *
 * Two layouts are accepted (column order is free, header names are
 * case-insensitive, "start" may be used instead of "time"):
 * - one event per row: `time,type,value[,duration][,insulin]` with type
 *   being one of basal (U/h), bolus (U), carbs (g), longacting (U),
 *   exercise (intensity in %) or glucose (mmol/L), an optional duration of
 *   carb intake or exercise in min, and an optional insulin name for
 *   long-acting injections (default: glargine)
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
    const insulinCol = column("insulin")
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
        const fail = (message: string): never => {
            throw new Error(`Line ${lineNumber}: ${message}`)
        }

        const time = parseDateTime(cells[timeCol] ?? "") ?? fail(
            `invalid time "${cells[timeCol] ?? ""}" (use YYYY-MM-DD HH:MM `
            + `or DD/MM/YYYY HH:MM)`)
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
        const event: PatientEvent = { time, type, value }
        if ((type === "carbs" || type === "exercise") &&
            durationCol >= 0 && cells[durationCol]) {
            event.duration = readNumber(durationCol, "duration")
        }
        const problem = checkEvent(event)
        if (problem) {
            fail(problem)
        }
        if (type === "exercise" && !event.duration) {
            event.duration = DEFAULT_EXERCISE_DURATION
        }
        if (type === "longacting") {
            event.insulin = DEFAULT_LONG_ACTING_INSULIN
        }
        if (type === "longacting" && insulinCol >= 0 && cells[insulinCol]) {
            const name = cells[insulinCol].toLowerCase()
            const insulin = LONG_ACTING_BRANDS[name]
                ?? LONG_ACTING_INSULINS.find((i) => i === name)
            if (typeof insulin === "undefined") {
                fail(`unknown long-acting insulin "${cells[insulinCol]}" (expected `
                    + LONG_ACTING_INSULINS.join(", ") + ")")
            }
            event.insulin = insulin
        }
        events.push(event)
    })

    return sortByTime(events)
}

/**
 * Reads a date and time, either as YYYY-MM-DD HH:MM (also with "T" between
 * date and time) or in the UK order DD/MM/YYYY HH:MM, optionally with
 * seconds. Other formats are rejected rather than guessed, since for
 * example 05/10/2026 means 5 October in the UK but 10 May in the US.
 *
 * @param {string} text - date and time
 * @returns {Date | undefined} local date and time, or undefined if invalid
 */
export function parseDateTime(text: string): Date | undefined {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
    const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/
    let parts: number[]
    let match = text.trim().match(iso)
    if (match) {
        parts = [match[1], match[2], match[3], match[4], match[5], match[6] ?? "0"]
            .map(Number)
    }
    else if ((match = text.trim().match(uk))) {
        parts = [match[3], match[2], match[1], match[4], match[5], match[6] ?? "0"]
            .map(Number)
    }
    else {
        return undefined
    }
    const [year, month, day, hour, minute, second] = parts
    const date = new Date(year, month - 1, day, hour, minute, second)
    // reject dates that do not exist, e.g. 31/02, and invalid times
    const exists = date.getFullYear() === year && date.getMonth() === month - 1
        && date.getDate() === day && hour < 24 && minute < 60 && second < 60
    return exists ? date : undefined
}

/**
 * Checks whether the values of an event make sense, e.g. no negative
 * amounts. Used for imported data and for changes made in the timeline.
 *
 * @param {PatientEvent} event - event to check
 * @returns {string | undefined} description of the problem, if any
 */
export function checkEvent(event: PatientEvent): string | undefined {
    const { type, value, duration } = event
    if (!isFinite(event.time.valueOf())) {
        return "invalid time"
    }
    if (!isFinite(value) || value < 0) {
        return "the amount must be 0 or more"
    }
    if (type === "glucose" && value > MAX_GLUCOSE_MMOL) {
        return `glucose ${value} looks like mg/dl, please use mmol/L`
    }
    if (type === "exercise" && value > 100) {
        return `exercise intensity ${value} must be at most 100 %`
    }
    if (typeof duration !== "undefined" && (!isFinite(duration) || duration <= 0)) {
        return "the duration must be more than 0 minutes"
    }
    return undefined
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

/**
 * Converts logged exercise events into exercise units for the simulator.
 * @param {PatientEvent[]} events
 * @returns {Exercise[]} exercise units
 */
export function getExercisesFromEvents(events: PatientEvent[]): Exercise[] {
    return events
        .filter((event) => event.type === "exercise" && event.value > 0)
        .map((event) => ({
            start: event.time,
            duration: event.duration ?? DEFAULT_EXERCISE_DURATION,
            intensity: event.value,
        }))
}

function splitRow(line: string): string[] {
    return line.split(",").map((cell) => cell.trim())
}
