/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/**
 * Converts a description that may contain HTML markup (e.g. sub- or
 * superscripts) into plain text, e.g. for accessible names of inputs.
 */
export default function plainText(html: string | undefined): string {
    const element = document.createElement("div")
    element.innerHTML = html ?? ""
    return (element.textContent ?? "").trim()
}
