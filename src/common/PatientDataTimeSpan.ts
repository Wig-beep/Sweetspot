/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { InsulinReading } from '../types/InsulinReading.js'
import Meal from '../types/Meal.js'

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
 * @param {InsulinReading[]} readings - logged insulin doses
 * @param {Meal[]} meals - logged meals
 * @param {number} tailHours - time to simulate after the last event in h
 * @returns start and end time, or undefined if there are no events
 */
export function getPatientDataTimeSpan(
    readings: InsulinReading[],
    meals: Meal[],
    tailHours = DEFAULT_TAIL_HOURS
): { t0: Date, tmax: Date } | undefined {
    const times = [
        ...readings.map((reading) => reading.time.valueOf()),
        ...meals.map((meal) => meal.start.valueOf()),
    ].filter(isFinite)

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
