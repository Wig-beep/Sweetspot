<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { ChartDataset, Plugin, Point } from 'chart.js'
import Chart from '../util/ChartSetup.js'
import { defineComponent } from 'vue'
import { GLUCOSE_RANGE, toMmolL } from '../../common/GlucoseUnits.js'
import { BGPrediction, ControllerInternals } from '../../types/Controller.js'
import PatientEvent from '../../types/PatientEvent.js'
import { SimulationResult } from '../../types/SimulationResult.js'
import glucoseColor, {
    glucoseColorLine,
    glucoseColorLineSegment
} from '../util/ChartGlucoseColor.js'
import { LOGGED_DAY_DASH, lineSwatch, runDash } from '../util/LineStyles.js'
import { fitLegendToWidth } from '../util/ResponsiveLegend.js'
import {
    EXERCISE_BORDER,
    EXERCISE_COLOR,
    exercisePlugin,
    fixAxisWidth,
    hasExercise,
    hoverLinePlugin,
    setExercise,
    setHoverTime,
    TimeInterval,
    timeAtPointer,
} from '../util/ChartSync.js'
import AccordionBox from './AccordionBox.vue'

/** index of the dataset showing the logged day in a what-if comparison */
const LOGGED_DAY_DATASET = 2
/** number of datasets that are always present (prediction, measured, logged) */
const FIXED_DATASETS = 3

/** line width of curves, of the latest run, and of a curve hovered in the legend */
const LINE_WIDTH = 2.5
const LATEST_LINE_WIDTH = 3.5
const HOVER_LINE_WIDTH = 6

/** colour of legend symbols (the curves themselves are coloured by range) */
const LEGEND_COLOR = "rgb(128,128,128)"

let circleCanvas: HTMLCanvasElement | undefined

/**
 * Plugin that shades the target range (3.9-10.0 mmol/L) behind the curves
 * and marks the hypo threshold with a dashed line.
 */
const TARGET_BAND_COLOR = "rgba(120, 176, 89, 0.15)"

const targetRangeBand: Plugin = {
    id: "targetRangeBand",
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea: area, scales: { y } } = chart
        if (!area || !y) return
        const clamp = (pixel: number) =>
            Math.min(area.bottom, Math.max(area.top, pixel))
        const top = clamp(y.getPixelForValue(GLUCOSE_RANGE.high))
        const bottom = clamp(y.getPixelForValue(GLUCOSE_RANGE.low))
        ctx.save()
        ctx.fillStyle = TARGET_BAND_COLOR
        ctx.fillRect(area.left, top, area.width, bottom - top)
        ctx.strokeStyle = "rgba(194, 1, 18, 0.7)"
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(area.left, bottom)
        ctx.lineTo(area.right, bottom)
        ctx.stroke()
        ctx.restore()
    },
}

/** legend symbol for measured glucose (a circle in the target range colour) */
function circleSwatch(): HTMLCanvasElement {
    let canvas = circleCanvas
    if (!canvas) {
        canvas = document.createElement("canvas")
        canvas.width = 12
        canvas.height = 12
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = glucoseColor(5.5)
        ctx.beginPath()
        ctx.arc(6, 6, 5, 0, 2 * Math.PI)
        ctx.fill()
        circleCanvas = canvas
    }
    return canvas
}

/**
 * Creates a curve of simulated glucose, coloured by glucose range and
 * identified by its line pattern.
 */
function glucoseCurve(label: string, dash: number[],
    data: Point[] = []): ChartDataset<"line"> {
    return {
        type: "line",
        label,
        data,
        tension: 0.5,
        borderWidth: LINE_WIDTH,
        borderDash: dash,
        borderColor: LEGEND_COLOR,
        backgroundColor: LEGEND_COLOR,
        segment: {
            borderColor: glucoseColorLineSegment
        },
    }
}

export default defineComponent({
    components: {
        AccordionBox
    },
    emits: ["runVisibilityChanged", "hoverTime"],
    props: {
        /** text alternative of the chart */
        description: { type: String, default: "Glucose chart" },
    },
    data() {
        return {
            preserveOldCurves: true,
            /** period shown, shared with the insulin and food chart */
            timeRange: null as { t0: Date, tmax: Date } | null,
            /** key of the latest run, which is drawn solid */
            latestKey: null as string | null,
            /**
             * keys identifying the simulation runs shown as curves, in the
             * order of the datasets following the fixed ones
             */
            runKeys: [] as string[],
        }
    },
    setup() {
        // allocate chart as member
        const chart = {} as Chart
        return { chart }
    },
    computed: {
        canvasid(): string {
            return "canvas_glucose_concentration"
        },
    },
    mounted() {
        const id = this.canvasid
        const canvas = document.getElementById(id) as HTMLCanvasElement
        const ctx = canvas.getContext('2d')!
        this.chart = new Chart(ctx, {
            type: "line",
            plugins: [targetRangeBand, exercisePlugin, hoverLinePlugin],
            data: {
                datasets: [
                    <ChartDataset>{
                        type: "line",
                        label: this.$t("prediction"),
                        borderColor: 'rgb(0,0,0,1)',
                        borderDash: [10, 2],
                        borderWidth: 1,
                        spanGaps: true
                    },
                    <ChartDataset>{
                        type: "line",
                        label: this.$t("measured"),
                        showLine: false,
                        pointStyle: "circle",
                        pointRadius: 4,
                        borderColor: glucoseColorLine,
                        backgroundColor: glucoseColorLine,
                        data: [],
                    },
                    <ChartDataset>glucoseCurve(
                        this.$t("logged"), LOGGED_DAY_DASH),
                ],
            },
            options: {
                onResize: (chart, size) => fitLegendToWidth(chart, size),
                // shared hover line with the insulin and food chart
                onHover: (event, _elements, chart) =>
                    this.$emit("hoverTime", timeAtPointer(event, chart)),
                layout: {
                    padding: { right: 20 },
                },
                scales: {
                    x: {
                        type: "time",   
                        offset: false,
                        time: {
                            displayFormats: {
                                hour: 'HH:mm'
                            },
                            // 24-hour time with the date, e.g. 5 Oct 14:30
                            tooltipFormat: 'd MMM HH:mm',
                        },
                    },
                    y: {
                        type: "linear",
                        title: { display: true, text: "mmol/L" },
                        ticks: { stepSize: 1 },
                        // never below 0: glucose cannot be negative, so results
                        // that go there (see modelLimitNote) are cut off
                        min: 0,
                        // extend below 2 mmol/L so that severe hypos stay visible
                        suggestedMin: 2,
                        suggestedMax: 12,
                        afterFit: fixAxisWidth,
                    },
                    // empty axis, as wide as the carbs axis of the insulin
                    // and food chart, so that both plot areas line up
                    yRight: {
                        position: "right",
                        grid: { drawOnChartArea: false },
                        ticks: { display: false },
                        border: { display: false },
                        afterFit: fixAxisWidth,
                    },
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (item) => `${item.dataset.label}: `
                                + `${item.parsed.y?.toFixed(1)} mmol/L`,
                        },
                    },
                    legend: {
                        onClick: (event, item, legend) => {
                            // the target range entry cannot be hidden
                            if ((item.datasetIndex ?? -1) < 0) return
                            Chart.defaults.plugins.legend.onClick.call(
                                legend, event, item, legend)
                            this.$emit("runVisibilityChanged")
                        },
                        // emphasise the curve whose legend entry is hovered
                        onHover: (_event, item) =>
                            this.emphasize(item.datasetIndex ?? null),
                        onLeave: () => this.emphasize(null),
                        labels: {
                            // show the line pattern of curves in the legend
                            generateLabels: (chart) => {
                                const items = Chart.defaults.plugins.legend
                                    .labels.generateLabels(chart)
                                for (const item of items) {
                                    const index = item.datasetIndex ?? 0
                                    if (index === 1) {
                                        item.pointStyle = circleSwatch()
                                    }
                                    if (index < 0) continue
                                    if (index < LOGGED_DAY_DATASET) continue
                                    const dataset = <ChartDataset<"line">>
                                        chart.data.datasets[index]
                                    item.pointStyle = lineSwatch(
                                        <number[]>dataset.borderDash ?? [],
                                        Math.min(<number>dataset.borderWidth, 4),
                                        LEGEND_COLOR)
                                }
                                // explain the shaded target range
                                items.push({
                                    text: `target range ${GLUCOSE_RANGE.low.toFixed(1)}`
                                        + `–${GLUCOSE_RANGE.high.toFixed(1)}`,
                                    fillStyle: "rgba(120, 176, 89, 0.35)",
                                    strokeStyle: "rgba(120, 176, 89, 0.8)",
                                    lineWidth: 1,
                                    pointStyle: "rect",
                                    hidden: false,
                                    datasetIndex: -1,
                                })
                                if (hasExercise(chart)) {
                                    items.push({
                                        text: "exercise",
                                        fillStyle: EXERCISE_COLOR,
                                        strokeStyle: EXERCISE_BORDER,
                                        lineWidth: 1,
                                        pointStyle: "rect",
                                        hidden: false,
                                        datasetIndex: -2,
                                    })
                                }
                                return items
                            },
                            // room for the line pattern symbols
                            pointStyleWidth: 40,
                            // keep runs in order, although the current one is
                            // drawn on top
                            // (the target range entry comes last)
                            sort: (a, b) => {
                                // entries for the target range and exercise
                                // (negative indices) come last
                                const order = (i?: number) =>
                                    (i ?? -1) < 0 ? 1000 - i! : i!
                                return order(a.datasetIndex) - order(b.datasetIndex)
                            },
                            // no legend for controller prediction, and for
                            // measured glucose and logged day if there are none
                            filter: (item, data) => {
                                const index = item.datasetIndex || 0
                                // target range entry
                                if (index < 0) return true
                                if (index === 0) return false
                                return index >= FIXED_DATASETS ||
                                    data.datasets[index].data.length > 0
                            }
                        }
                    },
                },
            },
        })
        fitLegendToWidth(this.chart)
    },
    methods: {
        /** removes the prediction of the previous run */
        reset() {
            this.chart.data.datasets[0].data = []
        },
        /** removes all simulation runs, e.g., when new patient data is loaded */
        clearRuns() {
            this.chart.data.datasets =
                this.chart.data.datasets.slice(0, FIXED_DATASETS)
            this.runKeys = []
            this.latestKey = null
            this.update()
        },
        /**
         * Shows the results of a simulation run as a new curve. Earlier runs
         * are kept with their own line pattern but hidden, to keep the chart
         * readable; they can be shown again by clicking on the legend. A run
         * with a key that is already shown is not added again but highlighted.
         *
         * @param {SimulationResult[]} results - results of the run
         * @param {string} key - identifies runs with identical inputs
         * @param {string} name - label prefix, numbered per run (e.g. what-if)
         * @param {string} label - label to use instead of a numbered name
         */
        addRun(results: SimulationResult[], key: string, name: string,
            label?: string) {
            let datasets = this.chart.data.datasets
            if (!this.preserveOldCurves) {
                this.clearRuns()
                datasets = this.chart.data.datasets
            }
            const data = results.map((result) => <Point>{
                x: result.t.valueOf(), y: toMmolL(result.y.Gp)
            })
            const index = this.runKeys.indexOf(key)
            if (index >= 0) {
                datasets[FIXED_DATASETS + index].data = data
            }
            else {
                const number = datasets.slice(FIXED_DATASETS).filter(
                    (dataset) => dataset.label?.startsWith(name)).length + 1
                const i = this.runKeys.length
                const curve = glucoseCurve(label ?? `${name} ${number}`,
                    runDash(i), data)
                datasets.push(<ChartDataset>{ ...curve, baseLabel: curve.label })
                this.runKeys.push(key)
                // hide earlier runs; they stay available in the legend
                for (let j = 0; j < i; j++) {
                    this.chart.setDatasetVisibility(FIXED_DATASETS + j, false)
                }
            }
            this.highlightRun(key)
        },
        /**
         * Marks the run with the given key as the latest one: it is drawn
         * solid, wider and on top, and labelled as latest in the legend.
         * All other runs keep their own line pattern.
         * @param {string | null} key - latest run, or null for none
         */
        highlightRun(key: string | null) {
            this.latestKey = key
            const datasets = this.chart.data.datasets
            this.runKeys.forEach((runKey, i) => {
                const dataset = <ChartDataset<"line"> & { baseLabel: string }>
                    datasets[FIXED_DATASETS + i]
                const isLatest = runKey === key
                dataset.borderDash = isLatest ? [] : runDash(i)
                dataset.order = isLatest ? 0 : 1
                dataset.label = isLatest
                    ? `${dataset.baseLabel} (${this.$t("latest")})`
                    : dataset.baseLabel
                if (isLatest) {
                    // make sure the latest run is visible
                    this.chart.setDatasetVisibility(FIXED_DATASETS + i, true)
                }
            })
            this.emphasize(null)
        },
        /**
         * Sets line widths: the curve with the given index is emphasised,
         * the latest run is slightly wider than the others.
         * @param {number | null} index - dataset to emphasise, or null
         */
        emphasize(index: number | null) {
            const datasets = this.chart.data.datasets
            for (let i = LOGGED_DAY_DATASET; i < datasets.length; i++) {
                const isLatest = i >= FIXED_DATASETS &&
                    this.runKeys[i - FIXED_DATASETS] === this.latestKey
                const dataset = <ChartDataset<"line">>datasets[i]
                dataset.borderWidth = i === index ? HOVER_LINE_WIDTH
                    : isLatest ? LATEST_LINE_WIDTH : LINE_WIDTH
            }
            this.update()
        },
        /** returns the label of the run with the given key */
        getRunLabel(key: string): string {
            const index = this.runKeys.indexOf(key)
            const dataset = <{ baseLabel?: string }>
                this.chart.data.datasets[FIXED_DATASETS + index]
            return dataset?.baseLabel ?? ""
        },
        /** returns the visibility of all runs, by key */
        getRunVisibility(): Record<string, boolean> {
            return Object.fromEntries(this.runKeys.map((key, i) =>
                [key, this.chart.isDatasetVisible(FIXED_DATASETS + i)]))
        },
        /** shows or hides the run with the given key */
        setRunVisible(key: string, visible: boolean) {
            const index = this.runKeys.indexOf(key)
            if (index >= 0) {
                this.chart.setDatasetVisibility(FIXED_DATASETS + index, visible)
                this.update()
            }
        },
        /**
         * Shows the simulated logged day, or hides it if no results are given.
         */
        setLoggedDay(results: SimulationResult[] | null) {
            const datasets = this.chart.data.datasets
            datasets[LOGGED_DAY_DATASET].data = (results ?? []).map(
                (result) => <Point>{
                    x: result.t.valueOf(), y: toMmolL(result.y.Gp)
                })
            this.update()
        },
        /** shows measured glucose (in mmol/L) from logged patient data */
        setMeasuredGlucose(events: PatientEvent[]) {
            this.chart.data.datasets[1].data = events.map(
                (event) => <Point>{ x: event.time.valueOf(), y: event.value })
            this.update()
        },
        /**
         * Shows the given period (the same as in the insulin and food
         * chart), or adapts to the simulated glucose if none is given.
         */
        setTimeRange(range: { t0: Date, tmax: Date } | null) {
            this.timeRange = range
            this.update()
        },
        /** draws the shared hover line at the given time (or removes it) */
        setHoverTime(time: number | null) {
            setHoverTime(this.chart, time)
        },
        /** shades the given periods of exercise */
        setExercise(periods: TimeInterval[]) {
            setExercise(this.chart, periods)
            this.update()
        },
        update() {
            const x = this.chart.options.scales!.x!
            if (this.timeRange) {
                x.min = this.timeRange.t0.valueOf()
                x.max = this.timeRange.tmax.valueOf()
            }
            else {
                // adapt scale only to simulated glucose, not predictions
                const tmax = Math.max(0, ...this.chart.data.datasets
                    .slice(LOGGED_DAY_DATASET)
                    .map((dataset) => (<Point | undefined>dataset.data.at(-1))?.x ?? 0))
                x.min = undefined
                x.max = tmax || undefined
            }
            this.chart.update()
        },
        controllerDataHover(t0: Date, data: ControllerInternals) {
            // draw oref0 glucose prediction, if available
            const predBG = data?.predictedBG
            if (typeof predBG !== "undefined") {
                this.chart.data.datasets[0].data = predBG.map(
                    (p: BGPrediction) => <Point>{ x: p.t.valueOf(), y: toMmolL(p.Gp) })
                this.update()
            }
        },
    },
})
</script>


<template>
    <AccordionBox :title="$t('title')" :initial="true">
        <div style="display: none;"> 
            <input type="checkbox" v-model="preserveOldCurves">
            <label for="preserveOldCurves">{{ $t("preserveOldCurves") }}</label>
        </div>
        <!-- what the colours of the curves mean; the summary and the text
             alternative of the chart give the same information in words -->
        <ul class="glucose-key" :aria-label="$t('key')">
            <li><span class="key-line key-high" aria-hidden="true"></span>{{ $t("keyHigh") }}</li>
            <li><span class="key-line key-in-range" aria-hidden="true"></span>{{ $t("keyInRange") }}</li>
            <li><span class="key-line key-low" aria-hidden="true"></span>{{ $t("keyLow") }}</li>
        </ul>
        <div class="canvas-chart">
            <canvas :id="canvasid" role="img" :aria-label="description"></canvas>
        </div>
    </AccordionBox>
</template>


<style scoped>
.glucose-key {
    list-style: none;
    padding: 0;
    margin: 0.25rem 0 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 0.9rem;
    color: var(--ss-text-secondary);
}

.glucose-key li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.key-line {
    display: inline-block;
    width: 1.5rem;
    height: 0;
    border-top: 4px solid;
}

.key-high {
    border-color: rgb(90, 150, 250);
}

.key-in-range {
    border-color: rgb(120, 176, 89);
}

.key-low {
    border-color: rgb(194, 1, 18);
}
</style>



<i18n locale="en">
{
	"title": "Glucose levels",
	"key": "Colours of the glucose curves",
	"keyHigh": "high (above 10)",
	"keyInRange": "in range (3.9 to 10)",
	"keyLow": "low (below 3.9)",
	"actual": "actual concentration",
	"prediction": "prediction by algorithm",
	"measured": "glucose readings",
	"logged": "original day",
	"latest": "latest",
	"preserveOldCurves": "preserve old curves",
}
</i18n>
