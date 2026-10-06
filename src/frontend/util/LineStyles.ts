/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/**
 * Line patterns that identify the logged day and the what-if runs in all
 * charts, so that they can be told apart without relying on colour.
 */

/** pattern of the logged day */
export const LOGGED_DAY_DASH = [10, 5]

/** patterns of simulation runs, used in turn; the latest run is solid */
export const RUN_DASHES = [
    [2, 4],
    [12, 4, 2, 4],
    [6, 3],
    [16, 6],
    [2, 3, 8, 3],
]

/** returns the line pattern of the run with the given index */
export function runDash(index: number): number[] {
    return RUN_DASHES[index % RUN_DASHES.length]
}

/** legend symbols showing line patterns */
const swatches = new Map<string, HTMLCanvasElement>()

/**
 * Returns a legend symbol showing a short line with the given pattern.
 * @param {number[]} dash - line pattern
 * @param {number} width - line width
 * @param {string} color - line colour
 */
export function lineSwatch(dash: number[], width: number,
    color: string): HTMLCanvasElement {
    const key = dash.join(",") + "/" + width + "/" + color
    let canvas = swatches.get(key)
    if (!canvas) {
        canvas = document.createElement("canvas")
        canvas.width = 40
        canvas.height = 12
        const ctx = canvas.getContext("2d")!
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.setLineDash(dash)
        ctx.beginPath()
        ctx.moveTo(0, 6)
        ctx.lineTo(40, 6)
        ctx.stroke()
        swatches.set(key, canvas)
    }
    return canvas
}
