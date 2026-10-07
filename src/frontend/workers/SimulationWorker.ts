/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { SimulationRequest, simulateRequest } from '../../common/SimulationRequest.js'
import { loadModule } from '../util/LoadModule.js'

/**
 * Background thread that simulates days of logged events, so that the page
 * keeps responding during long simulations. Receives { id, request } and
 * answers { id, simulation } or { id, error }.
 */
const scope = <Worker><unknown>self

scope.onmessage = async (event: MessageEvent<{ id: number, request: SimulationRequest }>) => {
    const { id, request } = event.data
    try {
        const simulation = await simulateRequest(request, loadModule)
        scope.postMessage({ id, simulation })
    }
    catch (error) {
        scope.postMessage({ id, error: String(error) })
    }
}
