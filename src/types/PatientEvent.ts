/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/** supported types of logged patient events */
export const PATIENT_EVENT_TYPES = ["basal", "bolus", "carbs", "glucose"] as const

/**
 * Type of a logged patient event and the unit of its value:
 * - basal: basal rate change in U/h, held until the next basal event
 * - bolus: insulin bolus in U
 * - carbs: carb intake in g
 * - glucose: measured glucose in mmol/L
 */
export declare type PatientEventType = typeof PATIENT_EVENT_TYPES[number]

/**
 * A logged patient event (e.g., imported from a CSV file).
 */
declare type PatientEvent = {
    /** time of the event */
    time: Date
    /** type of the event */
    type: PatientEventType
    /** value in the unit of the event type */
    value: number
    /** duration of carb intake in min (carbs only) */
    duration?: number
}
export default PatientEvent
