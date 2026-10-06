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
import { InsulinReading } from '../../types/InsulinReading.js'
import { ModuleProfile } from '../../types/ModuleProfile.js'
import { ParameterDescriptions } from '../../types/ParametricModule.js'
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

    /** logged doses, sorted by time */
    protected readings: InsulinReading[] = []
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
     * @param {InsulinReading[]} readings - logged basal rates and boluses
     */
    setReadings(readings: InsulinReading[]): void {
        this.readings = [...readings].sort(
            (a, b) => a.time.valueOf() - b.time.valueOf())
    }

    override reset(t: Date) {
        super.reset(t)
        // boluses logged before the start of the simulation are not given
        this.tLast = new Date(t.valueOf() - 1)
    }

    update(t: Date, _s: TracedMeasurement, _a: AnnouncementList = {}) {
        // basal rate of the latest reading at or before t
        let iir = 0
        for (const reading of this.readings) {
            if (reading.time > t) break
            iir = reading.basal
        }

        // boluses logged since the previous update (inclusive of t)
        let ibolus = 0
        const reason: string[] = []
        for (const reading of this.readings) {
            const isDue = reading.time > this.tLast && reading.time <= t
            if (isDue && reading.bolus > 0) {
                ibolus += reading.bolus
                reason.push("logged bolus: " + reading.bolus + " U at "
                    + reading.time.toLocaleString())
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
        return this.readings.find((reading) => reading.time > t)?.time
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
