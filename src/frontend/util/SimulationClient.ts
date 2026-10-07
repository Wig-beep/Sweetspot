/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { EventSimulation } from '../../common/SimulateEvents.js'
import { SimulationRequest, simulateRequest } from '../../common/SimulationRequest.js'
import { loadModule } from './LoadModule.js'

type Pending = {
    request: SimulationRequest
    resolve: (simulation: EventSimulation) => void
    reject: (error: unknown) => void
}

/**
 * Simulates days of logged events in a background thread (Web Worker).
 * If the browser cannot run it, or it fails, the day is simulated on the
 * page instead, so that results are always shown.
 */
export class SimulationClient {
    private worker?: Worker
    private pending = new Map<number, Pending>()
    private nextId = 0

    constructor() {
        try {
            this.worker = new Worker(
                new URL('../workers/SimulationWorker.ts', import.meta.url))
            this.worker.onmessage = (event) => this.answer(event.data)
            this.worker.onerror = (event) => {
                event.preventDefault()
                this.stopWorker()
            }
        }
        catch {
            this.worker = undefined
        }
    }

    /** simulates a day of logged events */
    simulate(request: SimulationRequest): Promise<EventSimulation> {
        if (!this.worker) {
            return simulateRequest(request, loadModule)
        }
        const id = this.nextId++
        return new Promise((resolve, reject) => {
            this.pending.set(id, { request, resolve, reject })
            this.worker!.postMessage({ id, request })
        })
    }

    private answer(data: { id: number, simulation?: EventSimulation, error?: string }) {
        const pending = this.pending.get(data.id)
        if (!pending) return
        this.pending.delete(data.id)
        if (data.simulation) {
            pending.resolve(data.simulation)
        }
        else {
            console.warn("Simulating on the page, the background thread failed: "
                + data.error)
            simulateRequest(pending.request, loadModule)
                .then(pending.resolve, pending.reject)
        }
    }

    /** stops the background thread and simulates waiting days on the page */
    private stopWorker() {
        console.warn("Simulating on the page, the background thread stopped")
        this.worker?.terminate()
        this.worker = undefined
        for (const pending of this.pending.values()) {
            simulateRequest(pending.request, loadModule)
                .then(pending.resolve, pending.reject)
        }
        this.pending.clear()
    }
}
