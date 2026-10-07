/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import { simulateEvents } from '../../src/common/SimulateEvents.js'
import {
    ModuleLoader,
    moduleSpec,
    requestKey,
    SimulationRequest,
    simulateRequest
} from '../../src/common/SimulationRequest.js'
import UvaPadova from '../../src/core/models/UvaPadova_T1DMS.js'
import IdealCGM from '../../src/core/sensors/IdealCGM.js'
import PatientEvent from '../../src/types/PatientEvent.js'

const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m)

const events: PatientEvent[] = [
    { time: at(7), type: "longacting", value: 14, insulin: "glargine" },
    { time: at(8), type: "bolus", value: 5 },
    { time: at(8), type: "carbs", value: 50 },
    { time: at(12), type: "glucose", value: 6 },
]

const load: ModuleLoader = async (type) => type === "patient" ? UvaPadova : IdealCGM

describe("SimulationRequest", () => {

    it("should simulate as with the original virtual person", async () => {
        const patient = new UvaPadova({})
        patient.setParameterValues({ BW: 85 })
        const sensor = new IdealCGM({})
        const request: SimulationRequest = {
            events,
            patient: moduleSpec("UvaPadova_T1DMS", patient),
            sensor: moduleSpec("IdealCGM", sensor),
            options: {},
            withExercise: false,
        }
        const { results } = await simulateRequest(request, load)
        const expected = simulateEvents(events, patient, sensor).results
        expect(results.length).to.equal(expected.length)
        expect(results.map((r) => r.y.Gp)).to.deep.equal(expected.map((r) => r.y.Gp))
        expect(results.at(-1)!.log?.IOB).to.be.a("number")
    })

    it("should give different keys for different virtual people", () => {
        const request = (BW: number): SimulationRequest => {
            const patient = new UvaPadova({})
            patient.setParameterValues({ BW })
            return {
                events,
                patient: moduleSpec("UvaPadova_T1DMS", patient),
                sensor: moduleSpec("IdealCGM", new IdealCGM({})),
                options: { t0: at(7), tmax: at(18) },
                withExercise: false,
            }
        }
        expect(requestKey(request(70))).to.equal(requestKey(request(70)))
        expect(requestKey(request(70))).not.to.equal(requestKey(request(85)))
    })
})
