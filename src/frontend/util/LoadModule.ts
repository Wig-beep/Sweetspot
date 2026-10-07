/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { ModuleLoader } from '../../common/SimulationRequest.js'

/**
 * Loads the class of a virtual person or sensor by its model id, from the
 * same chunks as the settings use.
 */
export const loadModule: ModuleLoader = async (type, model) => {
    const contents = type === "patient"
        ? await import(
            /* webpackChunkName: "models_[request]" */
            /* webpackMode: "lazy" */
            `../../core/models/${model}.ts`)
        : await import(
            /* webpackChunkName: "sensors_[request]" */
            /* webpackMode: "lazy" */
            `../../core/sensors/${model}.ts`)
    return contents.default
}
