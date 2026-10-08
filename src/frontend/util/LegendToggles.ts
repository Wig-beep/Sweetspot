/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { Chart, ChartEvent, LegendItem, Plugin } from 'chart.js'

/**
 * The legend of a chart is drawn on a canvas, so it can only be used with a
 * mouse or by touch. These helpers mirror its entries as checkboxes (see
 * ChartLineToggles.vue), which work with a keyboard and screen readers, and
 * use the legend's own click handler, so that both behave the same.
 */

/** a line of a chart that can be shown or hidden */
export declare type LegendLine = {
    /** index of the dataset */
    index: number
    /** its name, as in the legend */
    text: string
    /** whether it is shown */
    shown: boolean
}

/**
 * Reports the lines in the legend whenever they change (added, removed,
 * renamed, shown or hidden). Entries that are not datasets (e.g. the target
 * range) are left out.
 */
export function legendLinesPlugin(onChange: (lines: LegendLine[]) => void): Plugin {
    let last = ""
    return {
        id: "legendLines",
        afterDraw(chart) {
            const lines = (chart.legend?.legendItems ?? [])
                .filter((item) => (item.datasetIndex ?? -1) >= 0)
                .map((item) => ({
                    index: item.datasetIndex!,
                    // the full name (the legend may show a short one on phones)
                    text: chart.data.datasets[item.datasetIndex!].label ?? item.text,
                    shown: chart.isDatasetVisible(item.datasetIndex!),
                }))
            const json = JSON.stringify(lines)
            if (json !== last) {
                last = json
                onChange(lines)
            }
        },
    }
}

/** shows or hides a line, as a click on its legend entry does */
export function toggleLegendLine(chart: Chart, index: number) {
    const legend = chart.legend
    const item: LegendItem | undefined = legend?.legendItems
        ?.find((entry) => entry.datasetIndex === index)
    const onClick = chart.options.plugins?.legend?.onClick
    if (!legend || !item || !onClick) return
    // the handlers of the charts do not use the event
    onClick.call(legend, <ChartEvent><unknown>null, item, legend)
}
