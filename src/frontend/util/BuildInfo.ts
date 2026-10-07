/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/** information about this build, set by the bundler (see util/BuildInfo.ts) */
declare const __SWEETSPOT_BUILD__: {
    version: string
    personalData: boolean
    feedbackUrl: string
}

export const buildInfo = __SWEETSPOT_BUILD__
