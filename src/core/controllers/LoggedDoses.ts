/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { insulinOnBoard } from '../../common/InsulinOnBoard.js'
import {
    assumedPriorInjections,
    DEFAULT_LONG_ACTING_INSULIN,
    longActingRate
} from '../../common/LongActingInsulin.js'
import Controller, {
    AnnouncementList,
    ControllerOutput,
    Measurement,
    TracedMeasurement
} from '../../types/Controller.js'
import { ModuleProfile } from '../../types/ModuleProfile.js'
import { ParameterDescriptions } from '../../types/ParametricModule.js'
import PatientEvent from '../../types/PatientEvent.js'
import AbstractController from '../AbstractController.js'

export const profile: ModuleProfile = {
    type: "controller",
    id: "LoggedDoses",
    version: "1.1.0",
    name: "Logged doses",
}

/**
 * Controller that replays logged insulin doses (e.g., imported from a CSV
 * file) instead of computing them from measurements.
 *
 * The basal rate of the most recent reading is held until the next reading.
 * Each bolus is administered once, at the first update at or after its time.
 * Long-acting injections (MDI) are released over many hours and added to the
 * basal rate; the injections of the first day are assumed to have been taken
 * on the preceding days as well, so that the simulation starts with
 * long-acting insulin on board.
 *
 * The insulin on board of the quick-acting doses given so far is reported
 * in the internals (IOB), as a bolus advisor would estimate it.
 */
export default class LoggedDoses
    extends AbstractController<typeof LoggedDosesParameters>
    implements Controller {

    /** logged basal rate changes, sorted by time */
    protected basal: PatientEvent[] = []
    /** logged boluses, sorted by time */
    protected boluses: PatientEvent[] = []
    /** logged long-acting injections, sorted by time */
    protected injections: PatientEvent[] = []
    /** logged and assumed earlier long-acting injections */
    protected activeInjections: PatientEvent[] = []
    /** time of previous update; boluses up to this time have been given */
    protected tLast: Date = new Date(0)
    /** start of the simulation; boluses logged before it are not given */
    protected tStart: Date = new Date(0)

    getParameterDescription() {
        return LoggedDosesParameters
    }

    getI18n() {
        return { i18n_label, i18n_tooltip }
    }

    getModelInfo(): ModuleProfile {
        return profile
    }

    getInputList(): Array<keyof Measurement> {
        return []
    }

    getOutputList(): Array<keyof ControllerOutput> {
        return ["iir", "ibolus"]
    }

    /**
     * Sets the logged doses to be replayed.
     * @param {PatientEvent[]} events - logged events; only basal, bolus and
     *      long-acting events are used
     */
    setEvents(events: PatientEvent[]): void {
        const sorted = [...events].sort(
            (a, b) => a.time.valueOf() - b.time.valueOf())
        this.basal = sorted.filter((event) => event.type === "basal")
        this.boluses = sorted.filter((event) => event.type === "bolus")
        this.injections = sorted.filter((event) => event.type === "longacting")
        this.activeInjections = [
            ...assumedPriorInjections(this.injections),
            ...this.injections,
        ]
    }

    override reset(t: Date) {
        super.reset(t)
        // boluses logged before the start of the simulation are not given
        this.tLast = new Date(t.valueOf() - 1)
        this.tStart = t
    }

    update(t: Date, _s: TracedMeasurement, _a: AnnouncementList = {}) {
        // basal rate of the latest basal event at or before t
        let iir = 0
        for (const event of this.basal) {
            if (event.time > t) break
            iir = event.value
        }

        // insulin released from long-acting injections
        for (const injection of this.activeInjections) {
            iir += longActingRate(injection, t)
        }

        // boluses logged since the previous update (inclusive of t)
        let ibolus = 0
        const reason: string[] = []
        for (const event of this.boluses) {
            const isDue = event.time > this.tLast && event.time <= t
            if (isDue && event.value > 0) {
                ibolus += event.value
                reason.push("logged bolus: " + event.value + " U at "
                    + event.time.toLocaleString())
            }
        }
        for (const injection of this.injections) {
            if (injection.time > this.tLast && injection.time <= t) {
                reason.push("long-acting injection: " + injection.value + " U "
                    + (injection.insulin ?? DEFAULT_LONG_ACTING_INSULIN) + " at "
                    + injection.time.toLocaleString())
            }
        }
        this.tLast = t

        this.internals = {
            IOB: insulinOnBoard(this.boluses.filter(
                (event) => event.time >= this.tStart && event.time <= t), t),
            ...(reason.length ? { reason } : {}),
        }
        this.output = { iir, ibolus }
    }

    /**
     * Requests a simulation stop at the next logged dose, so that boluses
     * are given on time and basal changes and injections take effect
     * immediately.
     */
    override getNextUpdateTime(t: Date): Date | undefined {
        const next = [...this.basal, ...this.boluses, ...this.injections]
            .filter((event) => event.time > t)
            .map((event) => event.time.valueOf())
        return next.length ? new Date(Math.min(...next)) : undefined
    }
}


export const LoggedDosesParameters = {
} satisfies ParameterDescriptions


export const i18n_label = {
    en: {
        "name": "Logged doses",
    },
}


export const i18n_tooltip = {
    en: {
    },
}
