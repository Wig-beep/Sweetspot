/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

/**
 * Information about a build of SweetSpot, set by environment variables:
 *
 * - SWEETSPOT_PERSONAL_DATA=off builds a version that does not open the
 *   learner's own data (only practice scenarios and educators' scenario
 *   files), for deployments that need a clearly educational version
 * - SWEETSPOT_FEEDBACK_URL is where users report a problem or a safety
 *   concern (https: or mailto:); without it, users are asked to tell their
 *   diabetes educator
 */

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

/** short id of the commit built, if known */
function commit(): string {
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim()
    }
    catch {
        return ''
    }
}

function feedbackUrl(): string {
    const url = process.env.SWEETSPOT_FEEDBACK_URL ?? ''
    if (url && !/^(https:\/\/|mailto:)[^\s"'<>]+$/.test(url)) {
        throw new Error('SWEETSPOT_FEEDBACK_URL must be an https: or mailto: address')
    }
    return url
}

const sha = commit()

/**
 * version of the stylesheet from its contents, added to its address, so that
 * browsers never combine a new page with an old copy of the stylesheet
 */
const styleVersion = createHash('sha256')
    .update(readFileSync('./src/frontend/assets/styles/LT1style.css'))
    .digest('hex').slice(0, 8)

export const buildInfo = {
    /** version of SweetSpot, e.g. 0.1.0 (a1b2c3d) */
    version: pkg.sweetspotVersion + (sha ? ` (${sha})` : ''),
    /** whether the learner's own data can be opened */
    personalData: process.env.SWEETSPOT_PERSONAL_DATA !== 'off',
    feedbackUrl: feedbackUrl(),
    /** address of the stylesheet, with its version */
    stylesheet: `./styles/LT1style.css?v=${styleVersion}`,
}
