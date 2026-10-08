/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { Chart, ChartDataset, Plugin } from 'chart.js'

/** a point of the charts; values are numbers, missing ones NaN */
type XY = { x: number, y: number }

/**
 * Time axis and labels drawn on the charts, so that values can be read
 * without hovering (which needs a mouse) and without telling colours apart.
 */

/**
 * Time axis in the style of the text (8am, 2pm), kept horizontal; labels
 * are skipped where they would overlap. Tooltips show e.g. Mon 5 Oct 8:30am.
 */
export const TIME_AXIS = {
    time: {
        unit: "hour" as const,
        displayFormats: { hour: "haaa" },
        tooltipFormat: "EEE d MMM h:mmaaa",
    },
    ticks: {
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 20,
    },
}

const TEXT_COLOR = "#212b32"
const HALO_COLOR = "#ffffff"
const FONT = 'bold 12px Arial, "Helvetica Neue", Helvetica, sans-serif'

/** draws text with a white halo, so that it can be read over lines */
function drawLabel(chart: Chart, text: string, x: number, y: number,
    align: CanvasTextAlign = "center") {
    const ctx = chart.ctx
    ctx.save()
    ctx.font = FONT
    ctx.textAlign = align
    ctx.textBaseline = "middle"
    ctx.lineJoin = "round"
    ctx.lineWidth = 4
    ctx.strokeStyle = HALO_COLOR
    ctx.strokeText(text, x, y)
    ctx.fillStyle = TEXT_COLOR
    ctx.fillText(text, x, y)
    ctx.restore()
}

/**
 * Marks the lowest glucose of each glucose curve shown, if it is low, with
 * a ring and its value (e.g. "Lowest 2.8"), so that hypos can be found
 * without telling the red of low glucose from the green of in range.
 *
 * @param isCurve - which datasets are glucose curves
 * @param low - glucose below this is low (mmol/L)
 */
export function lowestGlucosePlugin(isCurve: (index: number) => boolean,
    low: number): Plugin {
    return {
        id: "lowestGlucose",
        afterDatasetsDraw(chart) {
            const area = chart.chartArea
            const placed: { x: number, y: number }[] = []
            chart.data.datasets.forEach((dataset, index) => {
                if (!isCurve(index) || !chart.isDatasetVisible(index)) return
                const points = <XY[]>dataset.data
                let lowest = -1
                points.forEach((point, i) => {
                    if (isFinite(point?.y) && point.y >= 0
                        && (lowest < 0 || point.y < points[lowest].y)) {
                        lowest = i
                    }
                })
                if (lowest < 0 || points[lowest].y >= low) return
                const element = chart.getDatasetMeta(index).data[lowest]
                if (!element) return
                const { x, y } = element
                const ctx = chart.ctx
                ctx.save()
                ctx.lineWidth = 2.5
                ctx.strokeStyle = TEXT_COLOR
                ctx.fillStyle = HALO_COLOR
                ctx.beginPath()
                ctx.arc(x, y, 5, 0, 2 * Math.PI)
                ctx.fill()
                ctx.stroke()
                ctx.restore()
                // below the ring, or above near the bottom; moved down if
                // another label is close
                let labelY = y + 16 > area.bottom - 4 ? y - 16 : y + 16
                while (placed.some((p) => Math.abs(p.x - x) < 70 && Math.abs(p.y - labelY) < 14)) {
                    labelY += 14
                }
                placed.push({ x, y: labelY })
                drawLabel(chart, `Lowest ${points[lowest].y.toFixed(1)}`, x, labelY)
            })
        },
    }
}

/**
 * Writes the amount next to each marker of a dose or meal shown (e.g. "6"
 * units of insulin, "60g" of carbs), so that it can be read without
 * hovering. Markers of the original day and a change at the same place get
 * one label.
 *
 * @param labelOf - the text for a value of a dataset, or undefined for
 *      datasets without labels
 */
export function amountLabelsPlugin(
    labelOf: (dataset: ChartDataset, index: number, value: number) => string | undefined): Plugin {
    return {
        id: "amountLabels",
        afterDatasetsDraw(chart) {
            const drawn = new Set<string>()
            chart.data.datasets.forEach((dataset, index) => {
                if (!chart.isDatasetVisible(index)) return
                const meta = chart.getDatasetMeta(index)
                const points = <XY[]>dataset.data
                points.forEach((point, i) => {
                    if (!isFinite(point?.y) || !(point.y > 0)) return
                    const text = labelOf(dataset, index, point.y)
                    const element = meta.data[i]
                    if (!text || !element) return
                    const x = Math.round(element.x)
                    const y = Math.round(element.y) - 17
                    const key = `${Math.round(x / 4)}:${Math.round(y / 4)}:${text}`
                    if (drawn.has(key)) return
                    drawn.add(key)
                    drawLabel(chart, text, x, Math.max(y, chart.chartArea.top + 6))
                })
            })
        },
    }
}
