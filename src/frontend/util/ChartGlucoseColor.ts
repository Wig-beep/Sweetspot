/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { Point, ScriptableContext, ScriptableLineSegmentContext } from 'chart.js'
import { GLUCOSE_RANGE } from '../../common/GlucoseUnits.js'

// all glucose values are in mmol/L

export function glucoseColorLine(ctx: ScriptableContext<"line">) {
    const value = <Point>ctx.dataset.data[ctx.dataIndex]
    return glucoseColor(value?.y ?? NaN)
}

export function glucoseColorLineSegment(ctx: ScriptableLineSegmentContext) {
    const y0 = ctx.p0.parsed.y ?? NaN
    const y1 = ctx.p1.parsed.y ?? NaN

    const mn = Math.min(y0, y1)
    const mx = Math.max(y0, y1)

    if (mn < GLUCOSE_RANGE.veryLow)
        return glucoseColor(mn)
    if (mx > GLUCOSE_RANGE.veryHigh)
        return glucoseColor(mx)
    if (mn < GLUCOSE_RANGE.low)
        return glucoseColor(mn)

    return glucoseColor(mx)
}

export default function glucoseColor(value: number): string {
    if (value < GLUCOSE_RANGE.veryLow)
        return 'rgb(140,25,22,1)'	// very low
    if (value < GLUCOSE_RANGE.low)
        return 'rgb(194,1,18,1)'	// low
    if (value > GLUCOSE_RANGE.veryHigh)
        return 'rgb(12,25,140,1)'	// very high
    if (value > GLUCOSE_RANGE.high)
        return 'rgb(90,150,250,1)'	// high

    return 'rgb(120,176,89,1)'  	// target
}
