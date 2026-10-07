/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { checkEvent, LONG_ACTING_BRANDS, sortByTime } from './PatientEvents.js'
import { Quiz, TeachingScenario, WhatIf } from './TeachingScenarios.js'
import PatientEvent, {
    LONG_ACTING_INSULINS,
    PATIENT_EVENT_TYPES,
    PatientEventType
} from '../types/PatientEvent.js'

/**
 * Practice scenarios written by educators, shared as files or links.
 *
 * A scenario file holds the texts of the scenario and its events as times
 * of day (no dates), so that it contains nothing that identifies a person or
 * a day. When opened, the events are placed on the current day, like the
 * built-in scenarios.
 */

/** identifies scenario files */
export const SCENARIO_FORMAT = "sweetspot-scenario"
export const SCENARIO_VERSION = 1

/** start of the part of a link that holds a scenario */
export const SCENARIO_LINK_PREFIX = "#scenario="

/** an event at a time of day */
export declare type ScenarioFileEvent = {
    /** time of day, HH:MM */
    time: string
    /** days after the first day (e.g. 1 for the night after), if any */
    day?: number
    type: PatientEventType
    value: number
    duration?: number
    insulin?: string
}

/** contents of a scenario file */
export declare type ScenarioFile = {
    format: typeof SCENARIO_FORMAT
    version: number
    title: string
    goal: string
    story: string
    events: ScenarioFileEvent[]
    whatIfs: { label: string, description: string, events: ScenarioFileEvent[] }[]
    keyPoints: string[]
    modelNote?: string
    quiz?: Quiz
}

/** limits that keep shared scenarios readable and links short */
export const SCENARIO_LIMITS = {
    text: 600,
    label: 60,
    events: 150,
    whatIfs: 6,
    keyPoints: 10,
    answers: 6,
}

const MS_PER_DAY = 24 * 3600e3

/** midnight at the start of the day of the given time */
function startOfDay(time: Date): Date {
    return new Date(time.getFullYear(), time.getMonth(), time.getDate())
}

/**
 * Converts a scenario into the contents of a scenario file: times become
 * times of day, counted from the day of the scenario's first event.
 */
export function scenarioToFile(scenario: TeachingScenario): ScenarioFile {
    const all = [scenario.events, ...scenario.whatIfs.map((w) => w.events)].flat()
    const first = Math.min(...all.map((e) => e.time.valueOf()))
    const day0 = startOfDay(new Date(isFinite(first) ? first : Date.now()))
    const toFileEvent = (event: PatientEvent): ScenarioFileEvent => {
        const t = event.time
        const day = Math.round((startOfDay(t).valueOf() - day0.valueOf()) / MS_PER_DAY)
        return {
            time: String(t.getHours()).padStart(2, "0") + ":"
                + String(t.getMinutes()).padStart(2, "0"),
            ...(day ? { day } : {}),
            type: event.type,
            value: event.value,
            ...(event.duration !== undefined ? { duration: event.duration } : {}),
            ...(event.insulin ? { insulin: event.insulin } : {}),
        }
    }
    return {
        format: SCENARIO_FORMAT,
        version: SCENARIO_VERSION,
        title: scenario.title,
        goal: scenario.goal,
        story: scenario.story,
        events: scenario.events.map(toFileEvent),
        whatIfs: scenario.whatIfs.map((w) => ({
            label: w.label, description: w.description, events: w.events.map(toFileEvent),
        })),
        keyPoints: scenario.keyPoints,
        ...(scenario.modelNote ? { modelNote: scenario.modelNote } : {}),
        ...(scenario.quiz ? { quiz: scenario.quiz } : {}),
    }
}

/** whether parsed JSON looks like a scenario file (to tell it from other files) */
export function isScenarioFile(data: unknown): boolean {
    return typeof data === "object" && data !== null
        && (<{ format?: unknown }>data).format === SCENARIO_FORMAT
}

/**
 * Reads the contents of a scenario file, checking every part of it, since
 * files and links come from other people.
 *
 * @param {unknown} data - parsed JSON
 * @param {Date} day - day to place the events on
 * @param {string} id - id of the scenario
 * @returns {TeachingScenario} the scenario
 * @throws {Error} if the file is not a valid scenario; the message says why
 */
export function scenarioFromFile(data: unknown, day: Date, id: string): TeachingScenario {
    if (!isScenarioFile(data)) {
        throw new Error("This is not a SweetSpot scenario")
    }
    const file = <Record<string, unknown>>data
    if (file.version !== SCENARIO_VERSION) {
        throw new Error("This scenario was made with a different version of SweetSpot")
    }
    const day0 = startOfDay(day)

    const text = (value: unknown, name: string, max = SCENARIO_LIMITS.text, optional = false) => {
        if (optional && (value === undefined || value === "")) return undefined
        if (typeof value !== "string" || value.trim() === "") {
            throw new Error(`The scenario has no ${name}`)
        }
        if (value.length > max) {
            throw new Error(`The ${name} is longer than ${max} characters`)
        }
        return value.trim()
    }
    const list = (value: unknown, name: string, max: number, optional = false): unknown[] => {
        if (optional && value === undefined) return []
        if (!Array.isArray(value)) {
            throw new Error(`The scenario has no ${name}`)
        }
        if (value.length > max) {
            throw new Error(`The scenario has more than ${max} ${name}`)
        }
        return value
    }
    const events = (value: unknown, name: string): PatientEvent[] => {
        const items = list(value, name, SCENARIO_LIMITS.events)
        if (items.length === 0) {
            throw new Error(`The ${name} have no entries`)
        }
        return sortByTime(items.map((item, i) => readEvent(item, day0, `${name}, entry ${i + 1}`)))
    }

    const whatIfs: WhatIf[] = list(file.whatIfs, "changes to try", SCENARIO_LIMITS.whatIfs)
        .map((item, i) => {
            const w = <Record<string, unknown>>(item ?? {})
            const label = text(w.label, `name of change ${i + 1}`, SCENARIO_LIMITS.label)!
            return {
                label,
                description: text(w.description, `description of "${label}"`)!,
                events: events(w.events, `entries of "${label}"`),
            }
        })
    const labels = whatIfs.map((w) => w.label)
    if (new Set(labels).size !== labels.length) {
        throw new Error("Two changes to try have the same name")
    }

    const scenario: TeachingScenario = {
        id,
        title: text(file.title, "title", SCENARIO_LIMITS.label * 2)!,
        goal: text(file.goal, "description of what learners will learn")!,
        story: text(file.story, "story")!,
        events: events(file.events, "entries of the day"),
        whatIfs,
        keyPoints: list(file.keyPoints, "things to remember", SCENARIO_LIMITS.keyPoints, true)
            .map((point, i) => text(point, `thing to remember ${i + 1}`)!),
    }
    const modelNote = text(file.modelNote, "note on the simulation", SCENARIO_LIMITS.text, true)
    if (modelNote) {
        scenario.modelNote = modelNote
    }
    if (file.quiz !== undefined) {
        scenario.quiz = readQuiz(file.quiz, labels, text, list)
    }
    return scenario
}

/** reads and checks an event of a scenario file */
function readEvent(item: unknown, day0: Date, name: string): PatientEvent {
    const e = <Record<string, unknown>>(item ?? {})
    const match = typeof e.time === "string" ? e.time.match(/^(\d{1,2}):(\d{2})$/) : null
    const day = e.day ?? 0
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59
        || typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 2) {
        throw new Error(`${name}: the time must be HH:MM on the day or up to 2 days after`)
    }
    if (!PATIENT_EVENT_TYPES.includes(<PatientEventType>e.type)) {
        throw new Error(`${name}: unknown type "${String(e.type)}"`)
    }
    const time = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + day,
        Number(match[1]), Number(match[2]))
    const event: PatientEvent = { time, type: <PatientEventType>e.type, value: Number(e.value) }
    if (e.duration !== undefined) {
        event.duration = Number(e.duration)
    }
    if (event.type === "longacting") {
        const name_ = String(e.insulin ?? "glargine").toLowerCase()
        const insulin = LONG_ACTING_INSULINS.find((i) => i === name_) ?? LONG_ACTING_BRANDS[name_]
        if (!insulin) {
            throw new Error(`${name}: unknown long-acting insulin "${String(e.insulin)}"`)
        }
        event.insulin = insulin
    }
    if (typeof e.value !== "number") {
        throw new Error(`${name}: the amount must be a number`)
    }
    const problem = checkEvent(event)
    if (problem) {
        throw new Error(`${name}: ${problem}`)
    }
    return event
}

/** reads and checks the quiz of a scenario file */
function readQuiz(value: unknown, labels: string[],
    text: (value: unknown, name: string, max?: number) => string | undefined,
    list: (value: unknown, name: string, max: number) => unknown[]): Quiz {
    const quiz = <Record<string, unknown>>(value ?? {})
    const answers = list(quiz.answers, "answers to the question", SCENARIO_LIMITS.answers)
        .map((item, i) => {
            const a = <Record<string, unknown>>(item ?? {})
            const whatIf = a.whatIf === undefined ? undefined : String(a.whatIf)
            if (whatIf !== undefined && !labels.includes(whatIf)) {
                throw new Error(`Answer ${i + 1} shows a change that is not in the scenario`)
            }
            return {
                text: text(a.text, `answer ${i + 1}`)!,
                correct: a.correct === true,
                feedback: text(a.feedback, `feedback on answer ${i + 1}`)!,
                ...(whatIf !== undefined ? { whatIf } : {}),
            }
        })
    if (answers.length < 2 || answers.filter((a) => a.correct).length !== 1) {
        throw new Error("The question needs at least 2 answers, one of them right")
    }
    return { question: text(quiz.question, "question")!, answers }
}

/** encodes a scenario file for a link (base64url of its JSON) */
export function encodeScenarioLink(file: ScenarioFile): string {
    const bytes = new TextEncoder().encode(JSON.stringify(file))
    let binary = ""
    bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
    return SCENARIO_LINK_PREFIX + btoa(binary)
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Decodes the scenario in the hash of a link.
 * @param {string} hash - e.g. location.hash
 * @returns {unknown} parsed JSON, or undefined if the link has no scenario
 * @throws {Error} if the link is damaged
 */
export function decodeScenarioLink(hash: string): unknown {
    if (!hash.startsWith(SCENARIO_LINK_PREFIX)) {
        return undefined
    }
    try {
        const base64 = hash.slice(SCENARIO_LINK_PREFIX.length)
            .replace(/-/g, "+").replace(/_/g, "/")
        const binary = atob(base64)
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
        return JSON.parse(new TextDecoder().decode(bytes))
    }
    catch {
        throw new Error("The link to this scenario is damaged. Ask for the link again, "
            + "and copy all of it")
    }
}
