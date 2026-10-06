<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { ChartDataset, Point } from 'chart.js'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { defineComponent } from 'vue'
import { toMmolL } from '../../common/GlucoseUnits.js'
import { BGPrediction, ControllerInternals } from '../../types/Controller.js'
import PatientEvent from '../../types/PatientEvent.js'
import { SimulationResult } from '../../types/SimulationResult.js'
import glucoseColor, {
    glucoseColorLine,
    glucoseColorLineSegment
} from '../util/ChartGlucoseColor.js'
import AccordionBox from './AccordionBox.vue'

/** index of the dataset showing the logged day in a what-if comparison */
const LOGGED_DAY_DATASET = 2
/** number of datasets that are always present (prediction, measured, logged) */
const FIXED_DATASETS = 3

/**
 * Line patterns that identify curves. All curves are coloured by glucose
 * range, so they are told apart by their pattern; the latest run is solid.
 */
const LOGGED_DAY_DASH = [10, 5]

/** patterns of simulation runs, used in turn */
const RUN_DASHES = [
    [2, 4],
    [12, 4, 2, 4],
    [6, 3],
    [16, 6],
    [2, 3, 8, 3],
]

/** line width of curves, of the latest run, and of a curve hovered in the legend */
const LINE_WIDTH = 2.5
const LATEST_LINE_WIDTH = 3.5
const HOVER_LINE_WIDTH = 6

/** colour of legend symbols (the curves themselves are coloured by range) */
const LEGEND_COLOR = "rgb(128,128,128)"

/** legend symbols showing line patterns, by pattern and width */
const swatches = new Map<string, HTMLCanvasElement>()

/**
 * Returns a legend symbol showing a short line with the given pattern.
 * @param {number[]} dash - line pattern
 * @param {number} width - line width
 */
function lineSwatch(dash: number[], width: number): HTMLCanvasElement {
    const key = dash.join(",") + "/" + width
    let canvas = swatches.get(key)
    if (!canvas) {
        canvas = document.createElement("canvas")
        canvas.width = 40
        canvas.height = 12
        const ctx = canvas.getContext("2d")!
        ctx.strokeStyle = LEGEND_COLOR
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

/** legend symbol for measured glucose (a circle in the target range colour) */
function circleSwatch(): HTMLCanvasElement {
    let canvas = swatches.get("circle")
    if (!canvas) {
        canvas = document.createElement("canvas")
        canvas.width = 12
        canvas.height = 12
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = glucoseColor(5.5)
        ctx.beginPath()
        ctx.arc(6, 6, 5, 0, 2 * Math.PI)
        ctx.fill()
        swatches.set("circle", canvas)
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
    data() {
        return {
            preserveOldCurves: true,
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
                            }
                        },
                    },
                    y: {
                        type: "linear",
                        title: { display: true, text: "mmol/L" },
                        ticks: { stepSize: 1 },
                        // extend below 2 mmol/L so that severe hypos stay visible
                        suggestedMin: 2,
                        suggestedMax: 12,
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
                                    if (index < LOGGED_DAY_DATASET) continue
                                    const dataset = <ChartDataset<"line">>
                                        chart.data.datasets[index]
                                    item.pointStyle = lineSwatch(
                                        <number[]>dataset.borderDash ?? [],
                                        Math.min(<number>dataset.borderWidth, 4))
                                }
                                return items
                            },
                            // room for the line pattern symbols
                            pointStyleWidth: 40,
                            // keep runs in order, although the current one is
                            // drawn on top
                            sort: (a, b) => a.datasetIndex! - b.datasetIndex!,
                            // no legend for controller prediction, and for
                            // measured glucose and logged day if there are none
                            filter: (item, data) => {
                                const index = item.datasetIndex || 0
                                if (index === 0) return false
                                return index >= FIXED_DATASETS ||
                                    data.datasets[index].data.length > 0
                            }
                        }
                    },
                },
            },
        })
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
         */
        addRun(results: SimulationResult[], key: string, name: string) {
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
                const curve = glucoseCurve(`${name} ${number}`,
                    RUN_DASHES[i % RUN_DASHES.length], data)
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
                dataset.borderDash = isLatest
                    ? [] : RUN_DASHES[i % RUN_DASHES.length]
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
        update() {
            const config = this.chart.config
            // adapt scale only to simulated glucose, not predictions
            const tmax = Math.max(0, ...this.chart.data.datasets
                .slice(LOGGED_DAY_DATASET)
                .map((dataset) => (<Point | undefined>dataset.data.at(-1))?.x ?? 0))
            if (typeof config.options === "undefined") {
                config.options = {}
            }
            if (typeof config.options.scales === "undefined") {
                config.options.scales = {}
            }
            if (typeof config.options.scales.x === "undefined") {
                config.options.scales.x = {}
            }
            config.options.scales.x.max = tmax || undefined
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
        <div class="canvas-chart">
            <canvas :id="canvasid"></canvas>
        </div>
    </AccordionBox>
</template>



<i18n locale="en">
{
	"title": "Glucose concentration",
	"actual": "actual concentration",
	"prediction": "prediction by algorithm",
	"measured": "measured glucose",
	"logged": "logged day",
	"latest": "latest",
	"preserveOldCurves": "preserve old curves",
}
</i18n>
<i18n locale="de">
{
	"title": "Glukosekonzentration",
	"actual": "Tatsächliche Glukosekonzentration",
	"prediction": "Prädiktion des Algorithmus",
	"measured": "Gemessene Glukose",
	"logged": "Protokollierter Tag",
	"latest": "neueste",
	"preserveOldCurves": "Alte Kurven beibehalten",
}
</i18n>
