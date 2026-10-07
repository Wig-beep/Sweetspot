/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { SimulatorOptions } from '../core/Simulator.js'
import Patient from '../types/Patient.js'
import PatientEvent from '../types/PatientEvent.js'
import { ParameterValues } from '../types/ParametricModule.js'
import Sensor from '../types/Sensor.js'
import { EventSimulation, simulateEvents } from './SimulateEvents.js'

/**
 * A module (virtual person or sensor) described by its model id and
 * parameter values, as in saved parameter files, so that it can be sent to
 * a background thread and created again there.
 */
export declare type ModuleSpec = {
    /** model id, i.e. the file name in src/core/models or src/core/sensors */
    model: string
    parameters: ParameterValues
}

/** everything needed to simulate a day of logged events */
export declare type SimulationRequest = {
    events: PatientEvent[]
    patient: ModuleSpec
    sensor: ModuleSpec
    options: Partial<SimulatorOptions>
    /** see simulateEvents */
    withExercise: boolean
}

/** loads the class of a module by its type and model id */
export declare type ModuleLoader = (type: "patient" | "sensor", model: string) =>
    Promise<new (parameters: ParameterValues) => unknown>

/**
 * Returns the description of a module with the given model id; the
 * parameters are copied as in a saved parameter file.
 */
export function moduleSpec(model: string,
    module: { getParameterValues(): ParameterValues }): ModuleSpec {
    return { model, parameters: JSON.parse(JSON.stringify(module.getParameterValues())) }
}

/**
 * Simulates a request: creates the virtual person and sensor again from
 * their descriptions and simulates the events.
 */
export async function simulateRequest(request: SimulationRequest,
    load: ModuleLoader): Promise<EventSimulation> {
    const Patient_ = await load("patient", request.patient.model)
    const Sensor_ = await load("sensor", request.sensor.model)
    return simulateEvents(request.events,
        <Patient>new Patient_(request.patient.parameters),
        <Sensor>new Sensor_(request.sensor.parameters),
        request.options, undefined, request.withExercise)
}

/**
 * Returns a key identifying a request: requests with the same key simulate
 * the same day with the same virtual person (apart from sensor noise).
 */
export function requestKey(request: SimulationRequest): string {
    return JSON.stringify(request)
}
