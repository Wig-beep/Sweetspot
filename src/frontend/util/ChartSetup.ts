/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/**
 * Chart.js with only the parts the app uses registered, instead of
 * 'chart.js/auto' which bundles every chart type, scale and plugin.
 * Import Chart from here; register more parts below if a chart needs them.
 */

import {
    Chart,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    ScatterController,
    TimeScale,
    Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

Chart.register(
    LineController,
    ScatterController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Legend,
    Tooltip,
)

export default Chart
