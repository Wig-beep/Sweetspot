/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/**
 * Glucose units.
 *
 * The simulation core works in mg/dl; values shown to users are in mmol/L.
 */

/** conversion factor between mg/dl and mmol/L */
export const MGDL_PER_MMOLL = 18.018

/** converts glucose from mg/dl to mmol/L */
export function toMmolL(mgdl: number): number {
    return mgdl / MGDL_PER_MMOLL
}

/** converts glucose from mmol/L to mg/dl */
export function toMgdl(mmolL: number): number {
    return mmolL * MGDL_PER_MMOLL
}

/**
 * Glucose range limits in mmol/L, following the international consensus on
 * time in range: target 3.9-10.0, low below 3.9, very low below 3.0,
 * high above 10.0, very high above 13.9.
 */
export const GLUCOSE_RANGE = {
    veryLow: 3.0,
    low: 3.9,
    high: 10.0,
    veryHigh: 13.9,
} as const

/**
 * Units involving glucose concentration, how they are shown instead, and the
 * factor to multiply values with for display.
 */
const DISPLAY_UNITS: Record<string, { unit: string, factor: number }> = {
    "mg/dl": { unit: "mmol/L", factor: 1 / MGDL_PER_MMOLL },
    "(mg/dl)/U": { unit: "(mmol/L)/U", factor: 1 / MGDL_PER_MMOLL },
    "(mg/dl)^2": { unit: "(mmol/L)^2", factor: 1 / MGDL_PER_MMOLL ** 2 },
}

/**
 * Returns the unit in which a value of the given unit is shown, and the
 * factor to convert it for display (1 if it is shown unchanged).
 * @param {string} unit - unit used in the simulation core
 */
export function displayUnit(unit: string): { unit: string, factor: number } {
    return DISPLAY_UNITS[unit] ?? { unit, factor: 1 }
}
