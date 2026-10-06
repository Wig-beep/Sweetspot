/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

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
    version: "1.0.0",
    name: "Logged doses",
}

/**
 * Controller that replays logged insulin doses (e.g., imported from a CSV
 * file) instead of computing them from measurements.
 *
 * The basal rate of the most recent reading is held until the next reading.
 * Each bolus is administered once, at the first update at or after its time.
 */
export default class LoggedDoses
    extends AbstractController<typeof LoggedDosesParameters>
    implements Controller {

    /** logged basal rate changes, sorted by time */
    protected basal: PatientEvent[] = []
    /** logged boluses, sorted by time */
    protected boluses: PatientEvent[] = []
    /** time of previous update; boluses up to this time have been given */
    protected tLast: Date = new Date(0)

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
     * @param {PatientEvent[]} events - logged events; only basal and bolus
     *      events are used
     */
    setEvents(events: PatientEvent[]): void {
        const sorted = [...events].sort(
            (a, b) => a.time.valueOf() - b.time.valueOf())
        this.basal = sorted.filter((event) => event.type === "basal")
        this.boluses = sorted.filter((event) => event.type === "bolus")
    }

    override reset(t: Date) {
        super.reset(t)
        // boluses logged before the start of the simulation are not given
        this.tLast = new Date(t.valueOf() - 1)
    }

    update(t: Date, _s: TracedMeasurement, _a: AnnouncementList = {}) {
        // basal rate of the latest basal event at or before t
        let iir = 0
        for (const event of this.basal) {
            if (event.time > t) break
            iir = event.value
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
        this.tLast = t

        this.internals = reason.length ? { reason } : {}
        this.output = { iir, ibolus }
    }

    /**
     * Requests a simulation stop at the next logged dose, so that boluses
     * are given on time and basal changes take effect immediately.
     */
    override getNextUpdateTime(t: Date): Date | undefined {
        const next = [...this.basal, ...this.boluses]
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
