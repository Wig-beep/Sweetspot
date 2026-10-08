/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent from '../types/PatientEvent.js'

/** time to keep simulating after the last logged event in h */
export const DEFAULT_TAIL_HOURS = 6

/** longest time between the first and the last entry of a day, in h */
export const MAX_ENTRY_SPAN_HOURS = 72

/** longest simulation SweetSpot runs, in h (the entries and the tail) */
export const MAX_SIMULATED_HOURS = MAX_ENTRY_SPAN_HOURS + 24

const MS_PER_MIN = 60e3
const MS_PER_HOUR = 3600e3

/**
 * Checks that the entries of a day are not too far apart, e.g. because of a
 * mistyped year: the simulation would run for a very long time and show
 * results that nobody can read.
 *
 * @param {PatientEvent[]} events - events of one day (and its changes)
 * @returns {string | undefined} description of the problem, if any
 */
export function checkTimeSpan(events: PatientEvent[]): string | undefined {
    const span = getPatientDataTimeSpan(events, 0)
    if (!span || span.tmax.valueOf() - span.t0.valueOf() <= MAX_ENTRY_SPAN_HOURS * MS_PER_HOUR) {
        return undefined
    }
    // e.g. Monday 5 October 2026, without the commas some browsers add
    const date = (d: Date) => {
        const part = (type: Intl.DateTimeFormatPartTypes) => new Intl.DateTimeFormat("en-GB",
            { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            .formatToParts(d).find((p) => p.type === type)!.value
        return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`
    }
    return `the entries are more than ${MAX_ENTRY_SPAN_HOURS / 24} days apart `
        + `(from ${date(span.t0)} to ${date(span.tmax)}). SweetSpot shows up to `
        + `${MAX_ENTRY_SPAN_HOURS / 24} days at a time. Check the dates`
}

/**
 * Determines the simulation time span covered by logged patient data.
 *
 * The simulation starts at the first logged event (rounded down to the full
 * minute) and ends some hours after the last one, so that the effect of the
 * last dose or meal is visible.
 *
 * @param {PatientEvent[]} events - logged events of any type
 * @param {number} tailHours - time to simulate after the last event in h
 * @returns start and end time, or undefined if there are no events
 */
export function getPatientDataTimeSpan(
    events: PatientEvent[],
    tailHours = DEFAULT_TAIL_HOURS
): { t0: Date, tmax: Date } | undefined {
    // exercise counts until its end
    const times = events
        .map((event) => event.time.valueOf() + (event.type === "exercise"
            ? (event.duration ?? 0) * MS_PER_MIN : 0))
        .concat(events.map((event) => event.time.valueOf()))
        .filter(isFinite)

    if (times.length === 0) {
        return undefined
    }

    const first = Math.min(...times)
    const last = Math.max(...times)
    return {
        t0: new Date(Math.floor(first / MS_PER_MIN) * MS_PER_MIN),
        tmax: new Date(last + tailHours * MS_PER_HOUR),
    }
}
