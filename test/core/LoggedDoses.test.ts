/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { expect } from 'chai'
import Simulator from '../../src/core/Simulator.js'
import StaticInsulinPump from '../../src/core/actuators/StaticInsulinPump.js'
import LoggedDoses from '../../src/core/controllers/LoggedDoses.js'
import VirtualPatientUvaPadova from '../../src/core/models/UvaPadova_T1DMS.js'
import IdealCGM from '../../src/core/sensors/IdealCGM.js'
import PatientEvent from '../../src/types/PatientEvent.js'

const at = (h: number, m: number) => new Date(2026, 9, 5, h, m)

describe("LoggedDoses", () => {

    describe("#update", () => {
        const controller = new LoggedDoses()
        // deliberately unsorted
        controller.setEvents([
            { time: at(12, 0), type: "basal", value: 0.5 },
            { time: at(8, 0), type: "bolus", value: 4 },
            { time: at(6, 0), type: "basal", value: 0.8 },
            { time: at(6, 0), type: "bolus", value: 2 },
            { time: at(9, 0), type: "carbs", value: 50 },
            { time: at(10, 0), type: "glucose", value: 7.5 },
        ])

        it("should hold the basal rate of the latest reading", () => {
            controller.reset(at(7, 0))
            controller.update(at(7, 0), {})
            expect(controller.getOutput().iir).to.equal(0.8)
            controller.update(at(8, 30), {})
            expect(controller.getOutput().iir).to.equal(0.8)
            controller.update(at(12, 30), {})
            expect(controller.getOutput().iir).to.equal(0.5)
        })

        it("should not give boluses logged before the start", () => {
            controller.reset(at(7, 0))
            controller.update(at(7, 0), {})
            expect(controller.getOutput().ibolus).to.equal(0)
        })

        it("should give a bolus once, even if no update hits its time", () => {
            controller.reset(at(7, 0))
            controller.update(at(7, 58), {})
            expect(controller.getOutput().ibolus).to.equal(0)
            controller.update(at(8, 3), {})
            expect(controller.getOutput().ibolus).to.equal(4)
            controller.update(at(8, 8), {})
            expect(controller.getOutput().ibolus).to.equal(0)
        })

        it("should request an update at the next logged dose only", () => {
            controller.reset(at(7, 0))
            expect(controller.getNextUpdateTime(at(7, 0))).to.deep.equal(at(8, 0))
            expect(controller.getNextUpdateTime(at(8, 0))).to.deep.equal(at(12, 0))
            expect(controller.getNextUpdateTime(at(13, 0))).to.be.undefined
        })
    })

    describe("#update with long-acting insulin", () => {
        const controller = new LoggedDoses()
        controller.setEvents([
            { time: at(8, 0), type: "basal", value: 0.5 },
            { time: at(22, 0), type: "longacting", value: 24, insulin: "glargine" },
        ])

        it("should start with long-acting insulin on board", () => {
            controller.reset(at(7, 0))
            controller.update(at(7, 0), {})
            // assumed injection of the previous day is on its plateau
            const plateau = 24 / ((26 + 23 - 3) / 2)
            expect(controller.getOutput().iir).to.be.closeTo(plateau, 1e-9)
        })

        it("should add long-acting release to the basal rate", () => {
            controller.reset(at(7, 0))
            controller.update(at(9, 0), {})
            const plateau = 24 / ((26 + 23 - 3) / 2)
            expect(controller.getOutput().iir).to.be.closeTo(0.5 + plateau, 1e-9)
        })

        it("should request an update at the injection", () => {
            controller.reset(at(7, 0))
            expect(controller.getNextUpdateTime(at(9, 0))).to.deep.equal(at(22, 0))
        })
    })

    describe("in Simulator", () => {
        it("should deliver every logged bolus off the time grid", () => {
            const events: PatientEvent[] = [
                { time: at(0, 0), type: "basal", value: 0.8 },
                { time: at(7, 32), type: "bolus", value: 5 },
                { time: at(15, 7), type: "bolus", value: 2 },
            ]
            const controller = new LoggedDoses()
            controller.setEvents(events)

            const sim = new Simulator()
            sim.setPatient(new VirtualPatientUvaPadova())
            sim.setController(controller)
            sim.setSensor(new IdealCGM())
            sim.setActuator(new StaticInsulinPump())
            sim.setOptions({ t0: at(0, 0), tmax: at(23, 55), dt: 5 })
            const results = sim.runSimulation()

            const boluses = results
                .filter((r) => (r.c.ibolus ?? 0) > 0)
                .map((r) => [r.t.valueOf(), r.c.ibolus])
            expect(boluses).to.deep.equal([
                [at(7, 32).valueOf(), 5],
                [at(15, 7).valueOf(), 2],
            ])
        })
    })
})
