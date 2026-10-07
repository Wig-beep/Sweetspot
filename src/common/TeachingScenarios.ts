/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import PatientEvent from '../types/PatientEvent.js'
import { sortByTime } from './PatientEvents.js'

/**
 * Teaching scenarios for people learning to adjust insulin (e.g., on a DAFNE
 * course). Each scenario is a simulated day of a virtual person on multiple
 * daily injections, plus what-ifs that show the effect of a different choice.
 *
 * Doses are calibrated to the default virtual patient (about 1 U per 10 g of
 * carbs) and to the exercise model where exercise is involved. They are
 * illustrations for discussion, not recommendations for anyone's own doses,
 * and should be reviewed by diabetes educators before use with learners.
 */

/** an alternative to the logged day */
export declare type WhatIf = {
    /** short name, also shown in the chart legend */
    label: string
    /** what is changed and why */
    description: string
    /** events of the what-if day */
    events: PatientEvent[]
}

export declare type TeachingScenario = {
    id: string
    title: string
    /** what the learner should understand */
    goal: string
    /** what happens on the logged day */
    story: string
    /** events of the logged day */
    events: PatientEvent[]
    /** alternatives to try */
    whatIfs: WhatIf[]
    /** messages to take away */
    keyPoints: string[]
    /** limitations of the simulation for this scenario */
    modelNote?: string
}

/** creates the events of a scenario on the given day */
type ScenarioBuilder = (at: (h: number, m?: number) => Date) => TeachingScenario

const glargine = (time: Date, value: number): PatientEvent =>
    ({ time, type: "longacting", value, insulin: "glargine" })
const bolus = (time: Date, value: number): PatientEvent =>
    ({ time, type: "bolus", value })
const carbs = (time: Date, value: number, duration = 15): PatientEvent =>
    ({ time, type: "carbs", value, duration })
const glucose = (time: Date, value: number): PatientEvent =>
    ({ time, type: "glucose", value })
const exercise = (time: Date, value: number, duration: number): PatientEvent =>
    ({ time, type: "exercise", value, duration })

/** replaces the event at index with the given events (or removes it) */
function replace(events: PatientEvent[], match: (e: PatientEvent) => boolean,
    ...replacement: PatientEvent[]): PatientEvent[] {
    const index = events.findIndex(match)
    if (index < 0) {
        throw new Error("scenario event to replace not found")
    }
    const result = [...events]
    result.splice(index, 1, ...replacement)
    return sortByTime(result)
}

const isBolusAt = (time: Date) => (e: PatientEvent) =>
    e.type === "bolus" && e.time.valueOf() === time.valueOf()

const builders: ScenarioBuilder[] = [

    (at) => {
        const logged = [
            glucose(at(7, 30), 5.6),
            carbs(at(8), 60), bolus(at(8), 6),
            glargine(at(22), 16),
        ]
        return {
            id: "bolus-timing",
            title: "When to take your mealtime insulin",
            goal: "How the timing of your quick-acting insulin changes your glucose after a meal.",
            story: "You have breakfast with 60g of carbs (6 CP). You take 6 units of quick-acting insulin as you start eating.",
            events: logged,
            whatIfs: [
                {
                    label: "20 minutes before eating",
                    description: "You take the same dose 20 minutes before you start eating.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(7, 40), 6)),
                },
                {
                    label: "30 minutes after eating",
                    description: "You take the same dose 30 minutes after you start eating.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(8, 30), 6)),
                },
                {
                    label: "1 hour after eating",
                    description: "You remember your insulin an hour after the meal.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(9), 6)),
                },
            ],
            keyPoints: [
                "Quick-acting insulin takes time to start working, but carbs start to raise your glucose within minutes.",
                "Taking your insulin before you eat keeps the rise after the meal lower. Taking it late makes the rise higher.",
                "If your glucose is low or falling before a meal, taking insulin early can cause a hypo. Follow the advice of your diabetes team.",
            ],
        }
    },

    (at) => {
        const logged = [
            glucose(at(7, 30), 5.5),
            carbs(at(8), 60), bolus(at(8), 6),
            carbs(at(10, 30), 40, 10),
            glucose(at(12), 11.5), bolus(at(12), 2),
            glucose(at(13), 11.4), bolus(at(13), 2),
            glucose(at(14), 10.4), bolus(at(14), 2),
            glargine(at(22), 16),
        ]
        return {
            id: "stacking",
            title: "Taking correction doses too close together",
            goal: "Why taking several correction doses close together can cause a hypo hours later.",
            story: "You had a 40g snack at 10:30am without insulin. At lunchtime your glucose is 11.5mmol/L, so you take 2 units to correct it. An hour later it is still high, so you take another 2 units. An hour after that, you take 2 more.",
            events: logged,
            whatIfs: [
                {
                    label: "1 correction, then wait",
                    description: "You take 1 correction of 3 units at 12pm and give it time to work.",
                    events: sortByTime([
                        ...logged.filter((e) => e.type !== "bolus" ||
                            e.time.valueOf() < at(12).valueOf()),
                        bolus(at(12), 3),
                    ]),
                },
                {
                    label: "2 corrections",
                    description: "You correct at 12pm and 1pm, but not at 2pm.",
                    events: replace(logged, isBolusAt(at(14))),
                },
                {
                    label: "insulin for the snack",
                    description: "You take 4 units for the snack at 10:30am, so you do not need a correction.",
                    events: sortByTime([
                        ...logged.filter((e) => e.type !== "bolus" ||
                            e.time.valueOf() < at(12).valueOf()),
                        bolus(at(10, 30), 4),
                    ]),
                },
            ],
            keyPoints: [
                "A correction dose keeps working for several hours, so your glucose comes down slowly.",
                "If you correct again while earlier insulin is still working, the doses add up (this is called stacking) and can cause a hypo later.",
                "The insulin on board line in the insulin and food chart shows how much quick-acting insulin is still working. See how it builds up with each correction.",
                "Before you correct, think about how much insulin is still working. Follow the correction rules from your course.",
            ],
        }
    },

    (at) => {
        // fat slows digestion and raises glucose for hours; here it is
        // approximated as 30 g of carb-equivalent absorbed 2-6 h after eating
        const fatEffect = carbs(at(21), 30, 240)
        const logged = [
            glucose(at(18, 45), 5.6),
            carbs(at(19), 80, 120), fatEffect, bolus(at(19), 8),
            glargine(at(22), 16),
        ]
        return {
            id: "high-fat-meal",
            title: "High-fat meals, like pizza",
            goal: "Why a high-fat meal can raise your glucose late into the night, and how splitting your dose can help.",
            story: "You have pizza in the evening: 80g of carbs (8 CP) with lots of fat. You take all 8 units of quick-acting insulin at the start of the meal.",
            events: logged,
            whatIfs: [
                {
                    label: "3 extra units 2 hours later",
                    description: "You take 8 units at the start of the meal and 3 more units 2 hours later.",
                    events: sortByTime([...logged, bolus(at(21), 3)]),
                },
                {
                    label: "split dose: 6 + 5 units",
                    description: "You take 6 units at the start of the meal and 5 units 90 minutes later.",
                    events: replace(logged, isBolusAt(at(19)),
                        bolus(at(19), 6), bolus(at(20, 30), 5)),
                },
                {
                    label: "11 units all at once",
                    description: "You take the same total of 11 units, all at the start of the meal.",
                    events: replace(logged, isBolusAt(at(19)), bolus(at(19), 11)),
                },
            ],
            keyPoints: [
                "Fat slows down digestion. Carbs from a high-fat meal arrive later, so your glucose can keep rising for hours.",
                "Taking all your insulin at the start can be too early for a slow meal. Taking a bigger dose all at once can cause a hypo soon after eating.",
                "Splitting your dose matches the insulin to the slower rise. Ask your diabetes team how to split doses.",
            ],
            modelNote: "The simulation cannot show fat directly. Its later effect is shown as an extra 30g of carbs absorbed between 2 and 6 hours after the meal. You can see this as a separate carbs entry in the timeline.",
        }
    },

    (at) => {
        const logged = [
            glucose(at(7, 30), 5.5),
            carbs(at(8), 60), bolus(at(8), 6),
            carbs(at(12), 60), bolus(at(12), 6),
            exercise(at(14), 30, 45),
            glargine(at(22), 12),
        ]
        return {
            id: "exercise",
            title: "Exercise after a meal",
            goal: "How exercise lowers your glucose during and after activity, and how changing your insulin or carbs can prevent a hypo.",
            story: "You go for a 45-minute jog at a moderate pace, 2 hours after lunch. You took your usual 6 units of quick-acting insulin for lunch.",
            events: logged,
            whatIfs: [
                {
                    label: "half the lunch insulin",
                    description: "You take half your usual lunch insulin: 3 units.",
                    events: replace(logged, isBolusAt(at(12)), bolus(at(12), 3)),
                },
                {
                    label: "20g of carbs before the jog",
                    description: "You take your usual lunch insulin and eat 20g of carbs just before the jog.",
                    events: sortByTime([...logged, carbs(at(13, 50), 20, 10)]),
                },
                {
                    label: "half the insulin and 20g of carbs",
                    description: "You take 3 units for lunch and eat 20g of carbs before the jog.",
                    events: sortByTime([
                        ...replace(logged, isBolusAt(at(12)), bolus(at(12), 3)),
                        carbs(at(13, 50), 20, 10),
                    ]),
                },
            ],
            keyPoints: [
                "Exercise makes your body use more glucose and makes insulin work harder, during exercise and for hours afterwards.",
                "If you plan to exercise after a meal, you may need less insulin for that meal.",
                "Extra carbs before or during exercise can also help. For longer exercise, you may need to do both.",
            ],
            modelNote: "This scenario uses a different virtual person who responds to exercise (the Deichmann 2021 model).",
        }
    },

    (at) => {
        const logged = [
            glucose(at(11, 45), 5.5),
            carbs(at(12), 50), bolus(at(12), 9),
            glucose(at(16, 45), 3.7), carbs(at(16, 45), 15, 5),
            glargine(at(22), 16),
        ]
        const isTreatment = (e: PatientEvent) =>
            e.type === "carbs" && e.time.valueOf() === at(16, 45).valueOf()
        return {
            id: "hypo-treatment",
            title: "Treating a hypo",
            goal: "How to treat a hypo with 15 to 20g of fast-acting carbs, check again, and treat again if you need to, without taking too much.",
            story: "You took too much insulin for lunch (9 units for 50g of carbs), so you have a hypo in the afternoon. At 4:45pm your glucose is 3.7mmol/L. You have 15g of fast-acting carbs, but you do not check your glucose again.",
            events: logged,
            whatIfs: [
                {
                    label: "15g, check again, 15g more",
                    description: "You have 15g at 4:45pm, check again after 15 minutes, and have another 15g because your glucose is still low.",
                    events: sortByTime([...logged, carbs(at(17), 15, 5)]),
                },
                {
                    label: "too much: 60g",
                    description: "You have 60g of carbs at 4:45pm instead of 15g.",
                    events: replace(logged, isTreatment, carbs(at(16, 45), 60, 10)),
                },
                {
                    label: "right lunch dose",
                    description: "You take 5 units for the 50g lunch, so you do not have a hypo.",
                    events: replace(
                        replace(logged, isBolusAt(at(12)), bolus(at(12), 5)),
                        isTreatment),
                },
            ],
            keyPoints: [
                "Treat a hypo with 15 to 20g of fast-acting carbs, like glucose tablets or a sugary drink. Check your glucose again after 10 to 15 minutes.",
                "If your glucose is still below 4mmol/L, treat it again. Insulin that is still working can keep your glucose low.",
                "Having much more than you need can make your glucose high later. Think about why the hypo happened, so you can prevent the next one.",
            ],
        }
    },
]

/**
 * Returns all teaching scenarios, with events on the given day.
 * @param {Date} day - any time on the day of the scenarios
 */
export function getTeachingScenarios(day: Date): TeachingScenario[] {
    const at = (h: number, m = 0) =>
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
    return builders.map((build) => {
        const scenario = build(at)
        return {
            ...scenario,
            events: sortByTime(scenario.events),
            whatIfs: scenario.whatIfs.map((w) =>
                ({ ...w, events: sortByTime(w.events) })),
        }
    })
}
