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
            title: "Timing of the meal bolus",
            goal: "See how the time of the bolus before a meal changes the rise in glucose after it.",
            story: "Breakfast with 60 g of carbs (6 CP). The 6 U bolus is given just as eating starts.",
            events: logged,
            whatIfs: [
                {
                    label: "bolus 20 min before",
                    description: "Same dose, injected 20 minutes before eating.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(7, 40), 6)),
                },
                {
                    label: "bolus 30 min after",
                    description: "Same dose, injected 30 minutes after starting to eat.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(8, 30), 6)),
                },
                {
                    label: "bolus 60 min after",
                    description: "Same dose, remembered an hour after the meal.",
                    events: replace(logged, isBolusAt(at(8)), bolus(at(9), 6)),
                },
            ],
            keyPoints: [
                "Rapid-acting insulin takes time to start working, while carbs start raising glucose within minutes.",
                "Injecting before eating lowers the peak after the meal; injecting late makes it higher.",
                "If glucose is low or falling before a meal, injecting early can be risky. Follow what you agreed with your diabetes team.",
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
            title: "Stacking correction doses",
            goal: "Understand why repeated corrections close together can lead to a hypo hours later.",
            story: "A 40 g snack at 10:30 was not covered with insulin. Glucose is 11.5 mmol/L at lunchtime, so a 2 U correction is given. Glucose is still high an hour later, so another 2 U is given, and again an hour after that.",
            events: logged,
            whatIfs: [
                {
                    label: "one correction, then wait",
                    description: "A single 3 U correction at 12:00, giving it time to work.",
                    events: sortByTime([
                        ...logged.filter((e) => e.type !== "bolus" ||
                            e.time.valueOf() < at(12).valueOf()),
                        bolus(at(12), 3),
                    ]),
                },
                {
                    label: "two corrections",
                    description: "Corrections at 12:00 and 13:00, but not at 14:00.",
                    events: replace(logged, isBolusAt(at(14))),
                },
                {
                    label: "snack covered",
                    description: "The 10:30 snack is covered with 4 U, so no correction is needed.",
                    events: sortByTime([
                        ...logged.filter((e) => e.type !== "bolus" ||
                            e.time.valueOf() < at(12).valueOf()),
                        bolus(at(10, 30), 4),
                    ]),
                },
            ],
            keyPoints: [
                "A correction keeps working for several hours, so glucose falls slowly after it.",
                "Correcting again while earlier insulin is still active adds up (stacking) and can cause a hypo later.",
                "Before correcting, think about how much insulin is still working, and follow the correction rules from your course.",
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
            title: "High-fat or slow meals",
            goal: "See why a high-fat meal such as pizza can raise glucose late into the night, and how splitting the dose can help.",
            story: "Pizza in the evening: 80 g of carbs (8 CP) with lots of fat. The full 8 U are given at the start of the meal.",
            events: logged,
            whatIfs: [
                {
                    label: "extra 3 U after 2 h",
                    description: "8 U at the start of the meal and another 3 U two hours later.",
                    events: sortByTime([...logged, bolus(at(21), 3)]),
                },
                {
                    label: "split 6 U + 5 U",
                    description: "6 U at the start of the meal and 5 U 90 minutes later.",
                    events: replace(logged, isBolusAt(at(19)),
                        bolus(at(19), 6), bolus(at(20, 30), 5)),
                },
                {
                    label: "11 U all at once",
                    description: "The same total of 11 U, all given at the start of the meal.",
                    events: replace(logged, isBolusAt(at(19)), bolus(at(19), 11)),
                },
            ],
            keyPoints: [
                "Fat slows down digestion, so carbs from a high-fat meal arrive later and glucose can keep rising for hours.",
                "Giving all the insulin at the start can be too early for a slow meal, and a larger dose at once can cause an early hypo.",
                "Splitting the dose matches insulin to the slower rise. Discuss how to split doses with your diabetes team.",
            ],
            modelNote: "The simulation does not model fat itself. Its later effect is approximated as 30 g of carbohydrate absorbed between 2 and 6 hours after the meal, shown as a separate carbs event in the timeline.",
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
            title: "Exercise",
            goal: "See how exercise lowers glucose during and after activity, and how adjusting insulin and carbs can prevent a hypo.",
            story: "A 45 minute jog at moderate intensity two hours after lunch. The usual 6 U lunch bolus was given.",
            events: logged,
            whatIfs: [
                {
                    label: "half lunch bolus",
                    description: "The lunch bolus is reduced by half to 3 U.",
                    events: replace(logged, isBolusAt(at(12)), bolus(at(12), 3)),
                },
                {
                    label: "20 g before exercise",
                    description: "The usual lunch bolus, plus 20 g of carbs just before the jog.",
                    events: sortByTime([...logged, carbs(at(13, 50), 20, 10)]),
                },
                {
                    label: "half bolus + 20 g",
                    description: "Lunch bolus reduced to 3 U and 20 g of carbs before the jog.",
                    events: sortByTime([
                        ...replace(logged, isBolusAt(at(12)), bolus(at(12), 3)),
                        carbs(at(13, 50), 20, 10),
                    ]),
                },
            ],
            keyPoints: [
                "Exercise makes the body use more glucose and makes insulin work harder, during and for hours after activity.",
                "Planned exercise after a meal is a reason to reduce the bolus for that meal.",
                "Extra carbs before or during exercise can help as well. Combining both is often needed for longer activity.",
            ],
            modelNote: "Exercise is simulated with the Deichmann 2021 virtual patient, as the default virtual patient does not respond to exercise.",
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
            goal: "Practise treating a hypo with 15-20 g of fast-acting carbs, rechecking, and repeating if needed, without over-treating.",
            story: "Too much insulin for lunch (9 U for 50 g) leads to a hypo in the afternoon. At 16:45 glucose is 3.7 mmol/L and 15 g of fast-acting carbs are taken, but glucose is not rechecked.",
            events: logged,
            whatIfs: [
                {
                    label: "15 g, recheck, 15 g more",
                    description: "15 g at 16:45, glucose rechecked after 15 minutes, and another 15 g because it is still low.",
                    events: sortByTime([...logged, carbs(at(17), 15, 5)]),
                },
                {
                    label: "over-treated with 60 g",
                    description: "60 g of carbs at 16:45 instead of 15 g.",
                    events: replace(logged, isTreatment, carbs(at(16, 45), 60, 10)),
                },
                {
                    label: "right lunch bolus",
                    description: "5 U for the 50 g lunch, so there is no hypo to treat.",
                    events: replace(
                        replace(logged, isBolusAt(at(12)), bolus(at(12), 5)),
                        isTreatment),
                },
            ],
            keyPoints: [
                "Treat a hypo with 15-20 g of fast-acting carbs, then recheck glucose after 10-15 minutes.",
                "If glucose is still low, treat again. Insulin that is still working can keep glucose down.",
                "Taking much more than needed causes a high glucose later. Find out why the hypo happened to prevent the next one.",
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
