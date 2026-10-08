/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { Chart } from 'chart.js'

/** charts narrower than this get a compact legend (in px) */
export const SMALL_CHART_WIDTH = 480

/**
 * A shorter name for a legend entry on small charts: the unit in brackets is
 * left out (the axis titles give it), and long names are shortened, e.g.
 * "Original quick-acting insulin on board (units)" becomes "Original
 * insulin on board". Names of changes are kept.
 */
export function shortLegendLabel(text: string): string {
    return text
        .replace(/ \((units|grams)[^)]*\)$/, "")
        .replace(/quick-acting insulin on board/i, (m) => m[0] === "Q" ? "Insulin on board" : "insulin on board")
        .replace(/background insulin injection/i, (m) => m[0] === "B" ? "Background injection" : "background injection")
}

/**
 * Makes the legend of a chart compact on small screens: smaller text and
 * symbols, so that the plot keeps enough room. Use as the chart's onResize
 * option and call once after creating the chart.
 */
export function fitLegendToWidth(chart: Chart, size = { width: chart.width }) {
    const isSmall = size.width < SMALL_CHART_WIDTH
    const labels = chart.options.plugins!.legend!.labels!
    labels.font = { size: isSmall ? 10 : 12 }
    labels.padding = isSmall ? 6 : 10
    labels.boxWidth = isSmall ? 8 : 12
    chart.update()
}
