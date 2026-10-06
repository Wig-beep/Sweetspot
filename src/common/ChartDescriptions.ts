/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { GlucoseMetrics } from './GlucoseMetrics.js'

/**
 * Text alternatives for the charts, so that their content is available to
 * screen reader users. They summarise the day (or the logged day and a
 * what-if) with the same numbers as the day summary.
 */

/** a simulated day to describe */
export declare type DescribedDay = {
    /** name of the day, e.g. "Logged day" or the name of a what-if */
    name: string
    metrics: GlucoseMetrics
}

const fixed = (value: number, decimals: number) =>
    isFinite(value) ? value.toFixed(decimals) : "unknown"

/**
 * Describes simulated glucose of one or more days.
 * @param {DescribedDay[]} days - days shown in the chart
 */
export function describeGlucose(days: DescribedDay[]): string {
    if (days.length === 0) {
        return "Glucose chart. There are no results yet."
    }
    return "Glucose chart in mmol/L. " + days.map(({ name, metrics: m }) =>
        `${name}: ${fixed(m.timeInRange, 0)}% of the time in range (3.9 to 10), `
        + `${fixed(m.timeBelowRange, 0)}% low (below 3.9), `
        + `${fixed(m.timeAboveRange, 0)}% high (above 10). `
        + `Lowest ${fixed(m.minGlucose, 1)}, highest ${fixed(m.maxGlucose, 1)}, `
        + `average ${fixed(m.meanGlucose, 1)}.`
    ).join(" ")
}

/**
 * Describes insulin and carbs of one or more days.
 * @param {DescribedDay[]} days - days shown in the chart
 */
export function describeInsulin(days: DescribedDay[]): string {
    if (days.length === 0) {
        return "Insulin and food chart. There are no results yet."
    }
    return "Insulin and food chart. " + days.map(({ name, metrics: m }) =>
        `${name}: ${fixed(m.bolusInsulin, 1)} units of quick-acting insulin, `
        + `${fixed(m.basalInsulin, 1)} units of background insulin, `
        + `${fixed(m.carbs, 0)}g of carbs.`
    ).join(" ")
}
