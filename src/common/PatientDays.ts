/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent from '../types/PatientEvent.js'
import { sortByTime } from './PatientEvents.js'

/**
 * Days in patient data. Exports from glucose sensors and pumps often cover
 * weeks; learners look at one day at a time.
 */

/** midnight (local time) at the start of the day of the given time */
function startOfDay(time: Date): Date {
    return new Date(time.getFullYear(), time.getMonth(), time.getDate())
}

/**
 * Returns the days that have events, in order.
 * @param {PatientEvent[]} events - patient data
 * @returns {Date[]} midnight at the start of each day
 */
export function getDays(events: PatientEvent[]): Date[] {
    const days = new Map<number, Date>()
    for (const event of events) {
        const day = startOfDay(event.time)
        days.set(day.valueOf(), day)
    }
    return [...days.values()].sort((a, b) => a.valueOf() - b.valueOf())
}

/**
 * Returns the events of one day.
 *
 * A pump rate set before the day still applies at its start, so it is
 * repeated at midnight. Long-acting injections of earlier days are not
 * needed: the simulation assumes the day's injections were also taken on
 * the days before.
 *
 * @param {PatientEvent[]} events - patient data
 * @param {Date} day - any time on the day
 * @returns {PatientEvent[]} events of the day, sorted by time
 */
export function eventsForDay(events: PatientEvent[], day: Date): PatientEvent[] {
    const start = startOfDay(day)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    const sorted = sortByTime(events)
    const dayEvents = sorted.filter((e) => e.time >= start && e.time < end)

    const earlierRates = sorted.filter((e) => e.type === "basal" && e.time < start)
    const rateAtStart = dayEvents.some((e) =>
        e.type === "basal" && e.time.valueOf() === start.valueOf())
    const lastRate = earlierRates.at(-1)
    if (lastRate && !rateAtStart) {
        dayEvents.unshift({ ...lastRate, time: start })
    }
    return dayEvents
}
