/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent, { LongActingInsulin } from '../types/PatientEvent.js'

/**
 * Simplified release profile of a long-acting insulin injection.
 *
 * The release rate rises linearly from zero to a plateau, stays constant and
 * then falls linearly back to zero. All times are in h after the injection.
 */
export declare type LongActingProfile = {
    /** end of the initial rise */
    onset: number
    /** end of the plateau */
    plateauEnd: number
    /** time when release has ended */
    duration: number
}

/**
 * Release profiles for long-acting insulins.
 *
 * These are coarse educational approximations based on the typical onset and
 * duration of action, not validated pharmacokinetic models. The profiles are
 * chosen so that the tail of one dose overlaps the rise of the next when
 * taken at the usual interval (once daily; twice daily for detemir):
 * - glargine: about 24 h with a mild wane around the time of injection
 * - glargine U300 and degludec: flat at steady state, with a slow rise and a
 *   long tail (degludec in particular reaches steady state slowly)
 * - detemir: more peaked and shorter
 */
export const LONG_ACTING_PROFILES: Record<LongActingInsulin, LongActingProfile> = {
    glargine: { onset: 3, plateauEnd: 23, duration: 26 },
    glargine_u300: { onset: 6, plateauEnd: 24, duration: 30 },
    degludec: { onset: 18, plateauEnd: 24, duration: 42 },
    detemir: { onset: 6, plateauEnd: 9, duration: 20 },
}

/** insulin assumed if a long-acting injection does not name one */
export const DEFAULT_LONG_ACTING_INSULIN: LongActingInsulin = "glargine"

const MS_PER_HOUR = 3600e3

/**
 * Computes the momentary release rate of a long-acting injection.
 *
 * @param {PatientEvent} injection - long-acting injection (value in U)
 * @param {Date} t - time of interest
 * @returns {number} release rate in U/h
 */
export function longActingRate(injection: PatientEvent, t: Date): number {
    const profile = LONG_ACTING_PROFILES[
        injection.insulin ?? DEFAULT_LONG_ACTING_INSULIN]
    const { onset, plateauEnd, duration } = profile
    const h = (t.valueOf() - injection.time.valueOf()) / MS_PER_HOUR
    if (h < 0 || h >= duration) {
        return 0
    }
    // area under the unit-height trapezoid, so that the total release is the dose
    const area = (duration + plateauEnd - onset) / 2
    let shape = 1
    if (h < onset) {
        shape = h / onset
    }
    else if (h > plateauEnd) {
        shape = (duration - h) / (duration - plateauEnd)
    }
    return injection.value * shape / area
}

/**
 * Creates the long-acting injections assumed to have been taken before the
 * logged data starts.
 *
 * Without them, a simulation would start with no long-acting insulin on board.
 * The injections of the first 24 hours (counted from the first injection) are
 * repeated on the preceding days, as far back as any of them still acts.
 *
 * @param {PatientEvent[]} injections - logged long-acting injections, sorted
 * @returns {PatientEvent[]} assumed earlier injections, sorted
 */
export function assumedPriorInjections(injections: PatientEvent[]): PatientEvent[] {
    if (injections.length === 0) {
        return []
    }
    const DAY = 24 * MS_PER_HOUR
    const first = injections[0].time.valueOf()
    const firstDay = injections.filter((i) => i.time.valueOf() < first + DAY)
    const longestDuration = Math.max(...firstDay.map((i) => LONG_ACTING_PROFILES[
        i.insulin ?? DEFAULT_LONG_ACTING_INSULIN].duration))
    const days = Math.ceil(longestDuration / 24)

    const prior: PatientEvent[] = []
    for (let day = days; day >= 1; day--) {
        for (const injection of firstDay) {
            prior.push({
                ...injection,
                time: new Date(injection.time.valueOf() - day * DAY),
            })
        }
    }
    return prior
}
