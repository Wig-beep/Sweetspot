/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { Chart, ChartEvent, Plugin, Scale } from 'chart.js'

/**
 * Helpers that make the glucose chart and the insulin and food chart work
 * as one: the same plot area and time range, a shared hover line, and
 * exercise shown as shaded periods in both.
 */

/** width of every y-axis in px, so that the plot areas line up */
export const AXIS_WIDTH = 64
/** narrower axes on small charts (e.g. phones), to leave room for the plot */
export const SMALL_AXIS_WIDTH = 44
const SMALL_CHART_WIDTH = 480

/**
 * Use as afterFit of a y-axis to give it the common width. Both charts have
 * the same width, so their axes and plot areas match.
 */
export function fixAxisWidth(scale: Scale) {
    scale.width = scale.chart.width < SMALL_CHART_WIDTH
        ? SMALL_AXIS_WIDTH : AXIS_WIDTH
}

/** a period of exercise */
export declare type TimeInterval = { start: Date, end: Date }

/** state shared by the plugins, kept on the chart */
type SyncedChart = Chart & {
    $hoverTime?: number | null
    $exercise?: TimeInterval[]
}

/** colour of exercise periods (and their legend symbol) */
export const EXERCISE_COLOR = "rgba(130, 90, 170, 0.15)"
export const EXERCISE_BORDER = "rgba(130, 90, 170, 0.6)"

/** draws a vertical line at the hovered time, in both charts */
export const hoverLinePlugin: Plugin = {
    id: "hoverLine",
    afterDatasetsDraw(chart) {
        const time = (<SyncedChart>chart).$hoverTime
        const { ctx, chartArea: area, scales: { x } } = chart
        if (time == null || !area || !x) return
        const pixel = x.getPixelForValue(time)
        if (pixel < area.left || pixel > area.right) return
        ctx.save()
        ctx.strokeStyle = "rgba(33, 43, 50, 0.6)"
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(pixel, area.top)
        ctx.lineTo(pixel, area.bottom)
        ctx.stroke()
        ctx.restore()
    },
}

/** shades periods of exercise behind the curves */
export const exercisePlugin: Plugin = {
    id: "exerciseBands",
    beforeDatasetsDraw(chart) {
        const periods = (<SyncedChart>chart).$exercise ?? []
        const { ctx, chartArea: area, scales: { x } } = chart
        if (!area || !x) return
        ctx.save()
        ctx.fillStyle = EXERCISE_COLOR
        for (const { start, end } of periods) {
            const left = Math.max(area.left, x.getPixelForValue(start.valueOf()))
            const right = Math.min(area.right, x.getPixelForValue(end.valueOf()))
            if (right > left) {
                ctx.fillRect(left, area.top, right - left, area.bottom - area.top)
            }
        }
        ctx.restore()
    },
}

/**
 * Returns the time under the pointer, or null if the pointer is outside the
 * plot area or has left the chart. Use in the chart's onHover option.
 */
export function timeAtPointer(event: ChartEvent, chart: Chart): number | null {
    const { chartArea: area, scales: { x } } = chart
    if (event.type === "mouseout" || event.x == null || !area || !x
        || event.x < area.left || event.x > area.right) {
        return null
    }
    return x.getValueForPixel(event.x) ?? null
}

/** sets the hovered time (or null) and redraws */
export function setHoverTime(chart: Chart, time: number | null) {
    const synced = <SyncedChart>chart
    if (synced.$hoverTime === time) return
    synced.$hoverTime = time
    chart.draw()
}

/** sets the exercise periods shown */
export function setExercise(chart: Chart, periods: TimeInterval[]) {
    (<SyncedChart>chart).$exercise = periods
}

/** whether the chart shows exercise */
export function hasExercise(chart: Chart): boolean {
    return ((<SyncedChart>chart).$exercise ?? []).length > 0
}
