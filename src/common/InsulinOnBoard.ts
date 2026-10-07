/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent from '../types/PatientEvent.js'

/**
 * Insulin on board (active insulin) of quick-acting doses, estimated as
 * bolus advisors and insulin pumps do. It is shown to explain dosing
 * decisions (e.g. stacking corrections); the virtual person absorbs
 * insulin according to its own model.
 */

/** time of the greatest effect of quick-acting insulin in min */
export const QUICK_ACTING_PEAK = 75
/** duration of action of quick-acting insulin in min */
export const QUICK_ACTING_DURATION = 300

/**
 * Returns the fraction of a dose that is still active after the given
 * time, using the exponential insulin action curve of Loop and oref0.
 *
 * @param {number} minutes - time since the dose in min
 * @param {number} peak - time of the greatest effect in min
 * @param {number} duration - duration of action in min
 * @returns {number} fraction between 1 (just taken) and 0 (used up)
 */
export function insulinOnBoardFraction(minutes: number,
    peak = QUICK_ACTING_PEAK, duration = QUICK_ACTING_DURATION): number {
    if (minutes <= 0) return 1
    if (minutes >= duration) return 0
    const tau = peak * (1 - peak / duration) / (1 - 2 * peak / duration)
    const a = 2 * tau / duration
    const S = 1 / (1 - a + (1 + a) * Math.exp(-duration / tau))
    const t = minutes
    return 1 - S * (1 - a) *
        ((t * t / (tau * duration * (1 - a)) - t / tau - 1) * Math.exp(-t / tau) + 1)
}

/**
 * Returns the insulin on board of quick-acting doses at the given time.
 *
 * @param {PatientEvent[]} boluses - quick-acting doses (bolus events)
 * @param {Date} t - time of interest
 * @returns {number} insulin on board in U
 */
export function insulinOnBoard(boluses: PatientEvent[], t: Date): number {
    let iob = 0
    for (const bolus of boluses) {
        const minutes = (t.valueOf() - bolus.time.valueOf()) / 60e3
        if (minutes >= 0) {
            iob += bolus.value * insulinOnBoardFraction(minutes)
        }
    }
    return iob
}
