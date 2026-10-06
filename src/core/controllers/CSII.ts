/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { quantize } from '../../common/UtilityFunctions.js'
import Controller, {
    AnnouncementList,
    ControllerOutput,
    Measurement,
    TracedMeasurement
} from '../../types/Controller.js'
import { ModuleProfile } from '../../types/ModuleProfile.js'
import { ParameterDescriptions } from '../../types/ParametricModule.js'
import { PatientProfile } from '../../types/Patient.js'
import AbstractController from '../AbstractController.js'

export const profile: ModuleProfile = {
    type: "controller",
    id: "CSII",
    version: "2.1.0",
    name: "CSII",
}


export default class CSII
    extends AbstractController<typeof CSIIParameters>
    implements Controller {

    getModelInfo(): ModuleProfile {
        return profile
    }
    
    getParameterDescription() {
        return CSIIParameters
    }

    getI18n() {
        return { i18n_label, i18n_tooltip }
    }

    getInputList(): Array<keyof Measurement> {
        return []
    }

    getOutputList(): Array<keyof ControllerOutput> {
        return ["iir"]
    }

    autoConfigure(profile: PatientProfile) {
        const IIReq = profile?.IIReq
        if (typeof IIReq !== "undefined") {
            this.setParameterValues({ basalRate: IIReq })
        }
    }

    update(t: Date, _s: TracedMeasurement, _a: AnnouncementList = {}) {
        const params = this.evaluateParameterValuesAt(t)
        this.output = { iir: quantize(params.basalRate, params.inc_basal) }
    }
}


export const CSIIParameters =
{
    /** basal rate in U/h */
    basalRate: { unit: 'U/h', default: 1, min: 0, step: 0.1 },
    /** basal rate increment in U/h */
    inc_basal: { unit: 'U/h', default: 0.05, min: 0, step: 0.01 },
} satisfies ParameterDescriptions


export const i18n_label = {
    en: {
        "name": "CSII (basal rate only)",
        "basalRate": "Basal rate",
        "inc_basal": "Increment",
    },
}


export const i18n_tooltip = {
    en: {
        "basalRate": "Basal rate means the amount of insulin per time that is continuously administered. It is measured in units per hour (U/h).",
        "inc_basal": "This is the difference between possible values of the basal rate. If it is greater than zero, the desired basal rate will be rounded."
    },
}
