/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import Simulator, { SimulatorOptions } from '../core/Simulator.js'
import StaticInsulinPump from '../core/actuators/StaticInsulinPump.js'
import LoggedDoses from '../core/controllers/LoggedDoses.js'
import Deichmann2021 from '../core/models/Deichmann2021.js'
import Patient from '../types/Patient.js'
import PatientEvent from '../types/PatientEvent.js'
import Sensor from '../types/Sensor.js'
import { SimulationResult } from '../types/SimulationResult.js'
import { getExercisesFromEvents, getMealsFromEvents } from './PatientEvents.js'
import { getPatientDataTimeSpan } from './PatientDataTimeSpan.js'

/** whether any of the events is exercise */
export function hasExercise(events: PatientEvent[]): boolean {
    return getExercisesFromEvents(events).length > 0
}

export declare type EventSimulation = {
    results: SimulationResult[]
    /**
     * true if the exercise model was used instead of the given patient,
     * because the given patient does not respond to exercise
     */
    usedExerciseModel: boolean
}

/**
 * Simulates a day of logged events (doses, meals, exercise): the doses are
 * replayed exactly, over the time span covered by the events unless given.
 *
 * If there is exercise but the patient model does not respond to it, the
 * Deichmann 2021 exercise model is used instead. Simulations with exercise
 * use 1 min steps, as the exercise model needs them to stay stable.
 *
 * @param {PatientEvent[]} events - logged events
 * @param {Patient} patient - virtual patient
 * @param {Sensor} sensor - glucose sensor
 * @param {Partial<SimulatorOptions>} options - simulator options
 * @param {Simulator} simulator - simulator to use (a new one by default)
 * @param {boolean} withExercise - simulate as for a day with exercise, even
 *      if these events have none; use it when comparing days so that all
 *      of them are simulated with the same virtual person and steps
 */
export function simulateEvents(
    events: PatientEvent[],
    patient: Patient,
    sensor: Sensor,
    options: Partial<SimulatorOptions> = {},
    simulator = new Simulator(),
    withExercise = hasExercise(events),
): EventSimulation {
    const exercises = getExercisesFromEvents(events)
    const usedExerciseModel = withExercise &&
        !patient.getInputList().includes("exercise")
    simulator.setPatient(usedExerciseModel ? new Deichmann2021() : patient)

    const controller = new LoggedDoses()
    controller.setEvents(events)
    simulator.setController(controller)
    simulator.setMeals(getMealsFromEvents(events))
    simulator.setExerciseUnits(exercises)
    simulator.setSensor(sensor)
    // logged doses are replayed exactly, without pump rounding or limits
    simulator.setActuator(new StaticInsulinPump({
        inc_basal: 0, inc_bolus: 0, max_basal: 100, max_bolus: 100,
    }))
    simulator.setOptions({
        ...getPatientDataTimeSpan(events),
        ...options,
        ...(withExercise ? { dt: 1 } : {}),
    })
    return { results: simulator.runSimulation(), usedExerciseModel }
}
