/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { toMmolL } from './GlucoseUnits.js'
import { DEFAULT_LONG_ACTING_INSULIN } from './LongActingInsulin.js'
import {
    checkEvent,
    LONG_ACTING_BRANDS,
    parseDateTime,
    parsePatientEventsCSV,
    readCSV,
    sortByTime
} from './PatientEvents.js'
import PatientEvent, { LONG_ACTING_INSULINS, LongActingInsulin } from '../types/PatientEvent.js'

/**
 * Reading of data exported from diabetes apps and devices: LibreView
 * (FreeStyle Libre), Dexcom Clarity and Nightscout, as well as the
 * SweetSpot CSV format.
 */

/** data read from a file */
export declare type ImportedData = {
    events: PatientEvent[]
    /** where the data comes from, e.g. "Dexcom Clarity export" */
    source: string
    /** what was not used or was assumed, in plain words */
    notes: string[]
}

/** glucose shown as "LO" or "HI" by Libre sensors, in mmol/L */
const LIBRE_LIMITS = { low: 2.2, high: 27.8 }
/** glucose shown as "Low" or "High" by Dexcom sensors, in mmol/L */
const DEXCOM_LIMITS = { low: 2.2, high: 22.2 }

/** effort in % of Dexcom exercise intensities */
const DEXCOM_EXERCISE: Record<string, number> = { light: 30, medium: 50, heavy: 70 }
/** effort in % of exercise without an intensity */
const DEFAULT_EXERCISE_EFFORT = 50

/**
 * Reads the events of a file, detecting its format from the contents.
 *
 * @param {string} text - contents of the file
 * @returns {ImportedData} events sorted by time, the format and notes
 * @throws {Error} if the file cannot be read; the message says why
 */
export function readPatientData(text: string): ImportedData {
    text = text.replace(/^﻿/, "")
    const trimmed = text.trimStart()
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        return readNightscout(trimmed)
    }
    const { rows, delimiter } = readCSV(text)
    const headerIndex = (test: (header: string[]) => boolean) =>
        rows.slice(0, 20).findIndex((row) => test(row.map((cell) => cell.toLowerCase())))

    const libre = headerIndex((h) => h.includes("device timestamp") && h.includes("record type"))
    if (libre >= 0) {
        return readLibreView(rows, libre, delimiter)
    }
    const dexcom = headerIndex((h) => h.includes("event type")
        && h.some((cell) => cell.startsWith("timestamp")))
    if (dexcom >= 0) {
        return readDexcomClarity(rows, dexcom, delimiter)
    }
    return { events: parsePatientEventsCSV(text), source: "SweetSpot CSV file", notes: [] }
}

/** collects events and notes while reading an export */
class EventCollector {
    events: PatientEvent[] = []
    private counts = new Map<string, number>()

    /** adds an event if its values make sense, otherwise counts it */
    add(event: PatientEvent) {
        if (checkEvent(event)) {
            this.count("entries with impossible values were not used")
            return
        }
        this.events.push(event)
    }

    /** counts something to mention in the notes */
    count(note: string) {
        this.counts.set(note, (this.counts.get(note) ?? 0) + 1)
    }

    /** returns the imported data */
    result(source: string, notes: string[] = []): ImportedData {
        if (this.events.length === 0) {
            throw new Error(`No glucose readings, insulin or carbs found in this ${source}`)
        }
        return {
            events: sortByTime(this.events),
            source,
            notes: [
                ...[...this.counts].map(([note, n]) => `${n} ${note}.`),
                ...notes,
            ],
        }
    }
}

/** reads a number, also with a decimal comma in files separated by ; or tabs */
function readNumber(text: string | undefined, delimiter: string): number {
    if (!text) return NaN
    return Number(delimiter === "," ? text : text.replace(",", "."))
}

/** returns the index of the first column whose name starts with one of the names */
function findColumn(header: string[], ...names: string[]): number {
    const lower = header.map((cell) => cell.toLowerCase())
    for (const name of names) {
        const index = lower.findIndex((cell) => cell.startsWith(name))
        if (index >= 0) return index
    }
    return -1
}

/** whether glucose in a column is in mg/dl (from the unit in its name) */
function isMgdl(header: string[], column: number): boolean {
    return /mg\/dl/i.test(header[column] ?? "")
}

/**
 * Reads a glucose value in mmol/L; "LO" and "HI" (readings out of the
 * sensor's range) are read as the limits of the range.
 */
function readGlucose(text: string | undefined, mgdl: boolean, delimiter: string,
    limits: { low: number, high: number }): number {
    const word = (text ?? "").toLowerCase()
    if (word === "lo" || word === "low") return limits.low
    if (word === "hi" || word === "high") return limits.high
    const value = readNumber(text, delimiter)
    return mgdl ? toMmolL(value) : value
}

/**
 * Reads the date and time of LibreView exports: DD-MM-YYYY HH:MM (UK and
 * Europe), MM-DD-YYYY hh:mm AM (US, with AM or PM), or YYYY-MM-DD HH:MM.
 */
export function parseLibreViewTime(text: string): Date | undefined {
    const match = text.trim().match(
        /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)
    if (!match) {
        return parseDateTime(text)
    }
    let [first, second, year, hour, minute, seconds] = match.slice(1, 7).map((p) => Number(p ?? 0))
    const ampm = match[7]?.toLowerCase()
    if (ampm) {
        // US exports: month first, 12-hour clock
        [first, second] = [second, first]
        if (hour < 1 || hour > 12) return undefined
        hour = (hour % 12) + (ampm === "pm" ? 12 : 0)
    }
    const pad = (n: number) => String(n).padStart(2, "0")
    return parseDateTime(`${year}-${pad(second)}-${pad(first)} ${pad(hour)}:${pad(minute)}:${pad(seconds)}`)
}

/**
 * Reads a LibreView CSV export (FreeStyle Libre readers and the LibreLink
 * app): sensor, scanned and finger-prick glucose, quick-acting and
 * long-acting insulin and carbs in grams.
 */
function readLibreView(rows: string[][], headerRow: number, delimiter: string): ImportedData {
    const header = rows[headerRow]
    const col = (...names: string[]) => findColumn(header, ...names)
    const time = col("device timestamp")
    const glucoseCols = [
        col("historic glucose"), col("scan glucose"), col("strip glucose"),
    ].filter((c) => c >= 0)
    const rapid = col("rapid-acting insulin (units)")
    const mealInsulin = col("meal insulin")
    const correctionInsulin = col("correction insulin")
    const longActing = col("long-acting insulin value", "long-acting insulin (units)")
    const carbs = col("carbohydrates (grams)")
    const servings = col("carbohydrates (servings)")

    const found = new EventCollector()
    let usedLongActing = false
    for (const cells of rows.slice(headerRow + 1)) {
        if (cells.every((cell) => cell === "")) continue
        const t = parseLibreViewTime(cells[time] ?? "")
        if (!t) {
            found.count("rows without a readable date were not used")
            continue
        }
        for (const c of glucoseCols) {
            if (cells[c]) {
                found.add({ time: t, type: "glucose",
                    value: readGlucose(cells[c], isMgdl(header, c), delimiter, LIBRE_LIMITS) })
            }
        }
        // the reader's bolus calculator splits doses into meal and correction
        let bolus = readNumber(cells[rapid], delimiter)
        if (!(bolus > 0)) {
            bolus = (readNumber(cells[mealInsulin], delimiter) || 0)
                + (readNumber(cells[correctionInsulin], delimiter) || 0)
        }
        if (bolus > 0) {
            found.add({ time: t, type: "bolus", value: bolus })
        }
        const units = readNumber(cells[longActing], delimiter)
        if (units > 0) {
            found.add({ time: t, type: "longacting", value: units,
                insulin: DEFAULT_LONG_ACTING_INSULIN })
            usedLongActing = true
        }
        const grams = readNumber(cells[carbs], delimiter)
        if (grams > 0) {
            found.add({ time: t, type: "carbs", value: grams })
        }
        else if (readNumber(cells[servings], delimiter) > 0) {
            found.count("carbs given in servings rather than grams were not used")
        }
    }
    return found.result("LibreView export",
        usedLongActing ? [longActingNote()] : [])
}

/**
 * Reads a Dexcom Clarity CSV export: sensor glucose (EGV), calibrations,
 * quick-acting and long-acting insulin, carbs and exercise.
 */
function readDexcomClarity(rows: string[][], headerRow: number, delimiter: string): ImportedData {
    const header = rows[headerRow]
    const col = (...names: string[]) => findColumn(header, ...names)
    const time = col("timestamp")
    const eventType = col("event type")
    const subtype = col("event subtype")
    const glucose = col("glucose value")
    const insulin = col("insulin value")
    const carbs = col("carb value")
    const duration = col("duration")

    const found = new EventCollector()
    let usedLongActing = false
    for (const cells of rows.slice(headerRow + 1)) {
        // rows about the person, devices and alerts have no time
        if (!cells[time]) continue
        const t = parseDateTime(cells[time])
        if (!t) {
            found.count("rows without a readable date were not used")
            continue
        }
        const type = (cells[eventType] ?? "").toLowerCase()
        const kind = (cells[subtype] ?? "").toLowerCase()
        if (type === "egv" || type === "calibration") {
            found.add({ time: t, type: "glucose",
                value: readGlucose(cells[glucose], isMgdl(header, glucose), delimiter, DEXCOM_LIMITS) })
        }
        else if (type === "insulin") {
            const units = readNumber(cells[insulin], delimiter)
            if (kind.startsWith("long")) {
                found.add({ time: t, type: "longacting", value: units,
                    insulin: DEFAULT_LONG_ACTING_INSULIN })
                usedLongActing = true
            }
            else {
                found.add({ time: t, type: "bolus", value: units })
            }
        }
        else if (type === "carbs") {
            found.add({ time: t, type: "carbs", value: readNumber(cells[carbs], delimiter) })
        }
        else if (type === "exercise") {
            const minutes = readDuration(cells[duration])
            found.add({ time: t, type: "exercise",
                value: DEXCOM_EXERCISE[kind] ?? DEFAULT_EXERCISE_EFFORT,
                ...(minutes ? { duration: minutes } : {}) })
            found.count("exercise entries were read with an effort of 30% (light), "
                + "50% (medium) or 70% (heavy)")
        }
        else {
            found.count(`other entries (such as ${type || "notes"}) were not used`)
        }
    }
    return found.result("Dexcom Clarity export",
        usedLongActing ? [longActingNote()] : [])
}

/** reads a duration given as hh:mm:ss or hh:mm, in minutes */
function readDuration(text: string | undefined): number | undefined {
    const match = (text ?? "").match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
    if (!match) return undefined
    const minutes = Number(match[1]) * 60 + Number(match[2]) + Number(match[3] ?? 0) / 60
    return minutes > 0 ? minutes : undefined
}

/** the note that background insulin is taken as glargine */
function longActingNote(): string {
    return "The type of background insulin is not in the file: it is taken as "
        + "glargine (e.g. Lantus). You can change it under \"Edit the day yourself\"."
}

/** a Nightscout entry (glucose) or treatment */
type NightscoutItem = {
    type?: string
    sgv?: number
    mbg?: number
    date?: number
    dateString?: string
    created_at?: string
    /** time of treatments uploaded by some apps (ISO text or ms) */
    timestamp?: string | number
    /** time in ms, added by Nightscout to treatments */
    mills?: number
    eventType?: string
    insulin?: number | null
    carbs?: number | null
    duration?: number
    glucose?: number | string
    units?: string
    insulinInjections?: string
}

/**
 * Reads Nightscout data downloaded as JSON from its API: entries (sensor
 * and meter glucose, in mg/dl) and treatments (insulin, carbs, exercise,
 * glucose checks). Injections logged with xDrip+ are sorted into
 * quick-acting and background insulin by their name.
 */
function readNightscout(text: string): ImportedData {
    let data: unknown
    try {
        data = JSON.parse(text)
    }
    catch {
        throw new Error("This JSON file could not be read")
    }
    const items: NightscoutItem[] = Array.isArray(data) ? data
        : [...((<{ entries?: [] }>data).entries ?? []),
            ...((<{ treatments?: [] }>data).treatments ?? [])]
    if (!items.every((item) => item !== null && typeof item === "object")) {
        throw new Error("This JSON file is not a Nightscout download")
    }

    const found = new EventCollector()
    let usedLongActing = false
    for (const item of items) {
        const t = new Date(item.created_at ?? item.timestamp ?? item.mills
            ?? item.dateString ?? item.date ?? NaN)
        if (!isFinite(t.valueOf())) {
            found.count("entries without a readable date were not used")
            continue
        }
        if (typeof item.sgv === "number") {
            found.add({ time: t, type: "glucose", value: toMmolL(item.sgv) })
            continue
        }
        if (typeof item.mbg === "number") {
            found.add({ time: t, type: "glucose", value: toMmolL(item.mbg) })
            continue
        }
        const eventType = (item.eventType ?? "").toLowerCase()
        if (eventType === "temp basal" || eventType === "profile switch") {
            found.count("pump basal changes were not used (the pump's basal "
                + "profile is not in the download)")
            continue
        }
        if (eventType === "exercise") {
            found.add({ time: t, type: "exercise", value: DEFAULT_EXERCISE_EFFORT,
                ...(item.duration ? { duration: item.duration } : {}) })
            found.count("exercise entries were read with an effort of 50%")
            continue
        }
        if (eventType === "bg check" && item.glucose !== undefined) {
            const value = Number(item.glucose)
            found.add({ time: t, type: "glucose",
                value: /mg/i.test(item.units ?? "") ? toMmolL(value) : value })
        }
        const injections = readInjections(item.insulinInjections)
        if (injections) {
            for (const { units, insulin } of injections) {
                if (insulin) {
                    found.add({ time: t, type: "longacting", value: units, insulin })
                    usedLongActing = true
                }
                else {
                    found.add({ time: t, type: "bolus", value: units })
                }
            }
        }
        else if ((item.insulin ?? 0) > 0) {
            found.add({ time: t, type: "bolus", value: item.insulin! })
        }
        if ((item.carbs ?? 0) > 0) {
            found.add({ time: t, type: "carbs", value: item.carbs! })
        }
    }
    return found.result("Nightscout download", usedLongActing
        ? ["Background insulin was recognised by its name (e.g. Lantus, Tresiba)."]
        : [])
}

/**
 * Reads the injections xDrip+ logs with a treatment, e.g.
 * [{"insulin":"Lantus","units":14}]; background insulins get their type.
 */
function readInjections(json: string | undefined):
    { units: number, insulin?: LongActingInsulin }[] | undefined {
    if (!json) return undefined
    try {
        const list = <{ insulin?: string, units?: number }[]>JSON.parse(json)
        if (!Array.isArray(list) || list.length === 0) return undefined
        return list.filter((i) => (i.units ?? 0) > 0).map((i) => {
            const name = (i.insulin ?? "").toLowerCase()
            const insulin = LONG_ACTING_BRANDS[name]
                ?? LONG_ACTING_INSULINS.find((type) => type === name)
            return { units: i.units!, ...(insulin ? { insulin } : {}) }
        })
    }
    catch {
        return undefined
    }
}
