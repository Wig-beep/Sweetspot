/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { SimulationResult } from '../types/SimulationResult.js'
import { GLUCOSE_RANGE, toMmolL } from './GlucoseUnits.js'

/**
 * Summary of a simulated period.
 */
export declare type GlucoseMetrics = {
    /** time with glucose in 3.9-10.0 mmol/L in % */
    timeInRange: number
    /** time with glucose below 3.9 mmol/L in % */
    timeBelowRange: number
    /** time with glucose below 3.0 mmol/L in % */
    timeVeryLow: number
    /** time with glucose above 10.0 mmol/L in % */
    timeAboveRange: number
    /** time-weighted mean glucose in mmol/L */
    meanGlucose: number
    /** lowest glucose in mmol/L */
    minGlucose: number
    /** highest glucose in mmol/L */
    maxGlucose: number
    /** total bolus insulin in U */
    bolusInsulin: number
    /** basal and long-acting insulin absorbed during the period in U */
    basalInsulin: number
    /** total carbs in g */
    carbs: number
}

const MS_PER_HOUR = 3600e3

/** glucose outside this range (in mmol/L) is not possible for a living person */
const POSSIBLE_GLUCOSE = { min: 1, max: 40 }

/**
 * Says if the glucose of a simulation is outside what is possible, which
 * happens with very large amounts: the model then no longer describes
 * anyone, so its results should not be read.
 *
 * @param {GlucoseMetrics} metrics - metrics of a simulation
 * @returns {string | undefined} message for the user, if there is a problem
 */
export function modelLimitNote(metrics: GlucoseMetrics): string | undefined {
    if (metrics.minGlucose >= POSSIBLE_GLUCOSE.min && metrics.maxGlucose <= POSSIBLE_GLUCOSE.max) {
        return undefined
    }
    return "With these amounts the model cannot show what would happen, because "
        + "glucose would go outside what is possible (below "
        + `${POSSIBLE_GLUCOSE.min} or above ${POSSIBLE_GLUCOSE.max}mmol/L). `
        + "Do not read anything into these results. Check the amounts you entered."
}

/**
 * Computes glucose and treatment metrics of a simulation run.
 *
 * Glucose is taken from the virtual patient (not the sensor). Since the
 * simulator uses variable time steps, each result is weighted with the time
 * until the next result.
 *
 * @param {SimulationResult[]} results - results of a simulation run
 * @returns {GlucoseMetrics} metrics
 */
export function computeGlucoseMetrics(results: SimulationResult[]): GlucoseMetrics {
    let total = 0
    let inRange = 0, below = 0, veryLow = 0, above = 0
    let weightedSum = 0
    let minGlucose = Infinity, maxGlucose = -Infinity
    let bolusInsulin = 0, basalInsulin = 0, carbs = 0

    results.forEach((result, i) => {
        const G = toMmolL(result.y.Gp)
        const next = results[i + 1]
        const hours = next ? (next.t.valueOf() - result.t.valueOf()) / MS_PER_HOUR : 0

        total += hours
        weightedSum += G * hours
        if (G < GLUCOSE_RANGE.veryLow) veryLow += hours
        if (G < GLUCOSE_RANGE.low) below += hours
        else if (G > GLUCOSE_RANGE.high) above += hours
        else inRange += hours
        minGlucose = Math.min(minGlucose, G)
        maxGlucose = Math.max(maxGlucose, G)

        bolusInsulin += result.c.ibolus ?? 0
        basalInsulin += (result.c.iir ?? 0) * hours
        carbs += result.u.meal ?? 0
    })

    const percent = (hours: number) => total > 0 ? 100 * hours / total : NaN
    return {
        timeInRange: percent(inRange),
        timeBelowRange: percent(below),
        timeVeryLow: percent(veryLow),
        timeAboveRange: percent(above),
        meanGlucose: total > 0 ? weightedSum / total : NaN,
        minGlucose: results.length ? minGlucose : NaN,
        maxGlucose: results.length ? maxGlucose : NaN,
        bolusInsulin,
        basalInsulin,
        carbs,
    }
}
