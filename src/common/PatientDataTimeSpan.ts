/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent from '../types/PatientEvent.js'

/** time to keep simulating after the last logged event in h */
export const DEFAULT_TAIL_HOURS = 6

const MS_PER_MIN = 60e3
const MS_PER_HOUR = 3600e3

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
    const times = events
        .map((event) => event.time.valueOf())
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
