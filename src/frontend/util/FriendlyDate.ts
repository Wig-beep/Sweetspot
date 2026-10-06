/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/**
 * Dates and times written as recommended in the NHS content style guide,
 * e.g. "7:30am on Tuesday 6 October" or "4am on Wednesday 7 October".
 */

/** time like "7:30am", "4am" or "12pm" */
export function friendlyTime(date: Date): string {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const suffix = hours < 12 ? "am" : "pm"
    const hour12 = hours % 12 === 0 ? 12 : hours % 12
    return minutes === 0
        ? `${hour12}${suffix}`
        : `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`
}

/** date and time like "7:30am on Tuesday 6 October" */
export function friendlyDateTime(date: Date): string {
    const day = date.toLocaleDateString("en-GB",
        { weekday: "long", day: "numeric", month: "long" })
    return `${friendlyTime(date)} on ${day}`
}
