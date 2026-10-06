/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

let counter = 0

/**
 * Returns an id that is unique on the page, e.g. for linking a label to its
 * input when a component is used more than once.
 * @param {string} prefix - readable start of the id
 */
export default function uniqueId(prefix: string): string {
    counter += 1
    return `${prefix}-${counter}`
}
