<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { ChartDataset, ChartDatasetCustomTypesPerDataset, Point } from 'chart.js'
import Chart from '../util/ChartSetup.js'
import { defineComponent, toRaw } from 'vue'
import { ControllerInternals } from '../../types/Controller.js'
import PatientEvent from '../../types/PatientEvent.js'
import { SimulationResult } from '../../types/SimulationResult.js'
import colors from '../util/Colors.js'
import { LOGGED_DAY_DASH, lineSwatch, runDash } from '../util/LineStyles.js'
import { fitLegendToWidth } from '../util/ResponsiveLegend.js'
import {
    exercisePlugin,
    fixAxisWidth,
    hoverLinePlugin,
    setExercise,
    setHoverTime,
    TimeInterval,
    timeAtPointer,
} from '../util/ChartSync.js'
import AccordionBox from './AccordionBox.vue'
import ChartLineToggles from './ChartLineToggles.vue'
import { LegendLine, legendLinesPlugin, toggleLegendLine } from '../util/LegendToggles.js'
import { amountLabelsPlugin, TIME_AXIS } from '../util/ChartLabels.js'

/** datasets that are kept for other pages but not shown in this app:
 *  insulin on board (2, only shown if there is any), carbs being absorbed
 *  (4), exercise intensity (5, shown as shaded periods instead) and pump
 *  output (6) */
const IOB_DATASET = 2
const HIDDEN_DATASETS = [4, 5, 6]
/** index of the dataset showing long-acting injections */
const LONG_ACTING_DATASET = 7
/**
 * number of datasets showing the main simulation (the logged day, if patient
 * data is loaded); datasets of what-if runs follow
 */
const BASE_DATASETS = 8

/** colour of insulin on board, apart from the green of background insulin */
const IOB_COLOR = "rgb(179, 89, 0)"

/** colour of filled markers in a comparison: hollow */
const HOLLOW = "rgba(0,0,0,0)"

/** dataset of a what-if run, tagged with the run and its role */
type RunDataset = ChartDataset & {
    runKey: string
    runRole: "basal" | "bolus" | "meal" | "longacting" | "iob"
}

export default defineComponent({
    emits: ["selectLog", "runVisibilityChanged", "hoverTime"],
    props: {
        /** text alternative of the chart */
        description: { type: String, default: "Insulin and carbs chart" },
    },
    components: {
        AccordionBox,
        ChartLineToggles
    },
    data() {
        return {
            /** lines in the legend, shown as checkboxes too */
            lines: [] as LegendLine[],
            controllerOutput: [] as { t: Date, log: ControllerInternals}[],
        }
    },
    setup() {
        // allocate chart as member
        const chart = {} as Chart
        return { chart }
    },
    computed: {
        canvasid(): string {
            return "canvas_insulin_carbs"
        },
    },
    mounted() {
        const component = this
        const id = this.canvasid
        const canvas = document.getElementById(id) as HTMLCanvasElement
        const ctx = canvas.getContext('2d')!
        this.chart = new Chart(ctx, {
            plugins: [
                // the legend as checkboxes, for keyboards and screen readers
                legendLinesPlugin((lines) => { this.lines = lines }),
                exercisePlugin, hoverLinePlugin,
                // amounts of quick-acting insulin, meals and background insulin
                amountLabelsPlugin((dataset, index, value) => {
                    const role = (<RunDataset>dataset).runRole
                    const amount = Number(value.toFixed(1))
                    if (index === 1 || role === "bolus" || index === LONG_ACTING_DATASET
                        || role === "longacting") {
                        return String(amount)
                    }
                    if (index === 3 || role === "meal") {
                        return `${Math.round(value)}g`
                    }
                    return undefined
                })],
            data: {
                datasets: [
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "line",
                        data: [],
                        yAxisID: 'y',
                        label: this.$t("iir"),
                        borderColor: colors['THURed'],
                        spanGaps: true,
                        stepped: "before",
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "scatter",
                        data: [],
                        yAxisID: 'y',
                        label: this.$t("ibolus"),
                        backgroundColor: colors['THURed'],
                        borderColor: colors['THUAnthrazit'],
                        radius: 10,
                        pointStyle: "triangle",
                        rotation: 180
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "line",
                        data: [],
                        yAxisID: 'y',
                        label: this.$t("iob"),
                        borderColor: IOB_COLOR,
                        backgroundColor: IOB_COLOR,
                        borderWidth: 2,
                        pointRadius: 0,
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "scatter",
                        data: [],
                        yAxisID: 'yG',
                        label: this.$t("totalmeal"),
                        borderColor: colors['THUAnthrazit'],
                        backgroundColor: colors['THUDarkBlue'],
                        radius: 10, pointStyle: "triangle"
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "line",
                        data: [],
                        yAxisID: 'yG',
                        label: this.$t("carbspermin"),
                        borderColor: colors['THUDarkBlue'],
                        stepped: "before"
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "line",
                        data: [],
                        yAxisID: 'yEx',
                        label: this.$t("exIntensity"),
                        borderColor: colors['THULightGray'],
                        stepped: "before"
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "line",
                        data: [],
                        yAxisID: 'y',
                        label: this.$t("pumpoutput"),
                        borderColor: colors['THURed'],
                        spanGaps: true,
                        stepped: "before",
                        hidden: true,
                    },
                    <ChartDatasetCustomTypesPerDataset>{
                        type: "scatter",
                        data: [],
                        yAxisID: 'yLong',
                        label: this.$t("longacting"),
                        backgroundColor: colors['THUGreen'],
                        borderColor: colors['THUAnthrazit'],
                        radius: 10,
                        pointStyle: "rectRot",
                    },
                ]
            },
            options: {
                onResize: (chart, size) => fitLegendToWidth(chart, size),
                // shared hover line with the glucose chart
                onHover: (event, _elements, chart) =>
                    this.$emit("hoverTime", timeAtPointer(event, chart)),
                layout: {
                    padding: { right: 20 },
                },
                scales: {
                    x: {
                        type: "time",   
                        offset: false,
                        // times as in the text (8am), horizontal
                        ...TIME_AXIS,
                    },
                    y: {
                        title: { display: true, text: "Insulin (units)" },
                        min: 0,
                        ticks: { stepSize: 1 },
                        suggestedMax: 2,
                        afterFit: fixAxisWidth,
                    },
                    yG: {
                        title: { display: true, text: "Carbs (grams)" },
                        position: 'right',
                        min: 0,
                        suggestedMax: 30,
                        ticks: { stepSize: 10 },
                        grid: { drawOnChartArea: false },
                        afterFit: fixAxisWidth,
                    },
                    // long-acting doses are much larger than rates and
                    // boluses, so they get their own (hidden) axis
                    yLong: {
                        display: false,
                        min: 0,
                    },
                    yEx: {
                        // exercise is shown as shaded periods instead
                        display: false,
                        title: { display: true, text: "%" },
                        position: 'right',
                        min: 0,
                        suggestedMax: 100,
                        ticks: { stepSize: 10 },
                        grid: { drawOnChartArea: false },
                    },
                },
                plugins: {
                    legend: {
                        // a what-if run is shown and hidden as a whole
                        onClick: (event, item, legend) => {
                            const dataset = <RunDataset>
                                this.chart.data.datasets[item.datasetIndex ?? 0]
                            if (!dataset.runKey) {
                                Chart.defaults.plugins.legend.onClick.call(
                                    legend, event, item, legend)
                                return
                            }
                            const visible = !this.chart.isDatasetVisible(
                                item.datasetIndex ?? 0)
                            this.setRunVisible(dataset.runKey, visible)
                            this.$emit("runVisibilityChanged",
                                dataset.runKey, visible)
                        },
                        labels: {
                            // no legend for long-acting insulin if there is
                            // none; one entry per what-if run
                            filter: (item, data) => {
                                const index = item.datasetIndex ?? 0
                                const dataset = <RunDataset>data.datasets[index]
                                if (dataset.runKey) {
                                    return dataset.runRole === "basal"
                                }
                                if (HIDDEN_DATASETS.includes(index)) {
                                    return false
                                }
                                if (index === IOB_DATASET) {
                                    return dataset.data.length > 0
                                }
                                return index !== LONG_ACTING_DATASET ||
                                    dataset.data.length > 0
                            },
                            // show the line pattern of what-if runs
                            generateLabels: (chart) => {
                                const items = Chart.defaults.plugins.legend
                                    .labels.generateLabels(chart)
                                for (const item of items) {
                                    const dataset = <RunDataset &
                                        ChartDataset<"line">>
                                        chart.data.datasets[item.datasetIndex ?? 0]
                                    if (dataset.runKey || item.datasetIndex === 0) {
                                        item.pointStyle = lineSwatch(
                                            <number[]>dataset.borderDash ?? [],
                                            2, colors['THURed'])
                                    }
                                    else if (item.datasetIndex === IOB_DATASET) {
                                        item.pointStyle = lineSwatch(
                                            <number[]>dataset.borderDash ?? [],
                                            2, IOB_COLOR)
                                    }
                                }
                                return items
                            },
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                const ctx = context.filter(
                                    (context_) => context_.datasetIndex <= 2)
                                if (ctx.length === 0) return
                                const t0: number = ctx[0].parsed.x ?? NaN
                                const output = component.controllerOutput.filter(
                                    (entry: any) => entry.t.valueOf() === t0)
                                if (output.length) {
                                    component.$emit("selectLog", new Date(t0), toRaw(output[0].log))
                                }
                            },
                        },
                    },
                },
            },
        })
        fitLegendToWidth(this.chart)
    },
    methods: {
        /** shows or hides a line, as its legend entry does */
        toggleLine(index: number) {
            toggleLegendLine(this.chart, index)
        },
        /** clears the main simulation; what-if runs are kept */
        reset() {
            let datasets = this.chart.data.datasets
            for (let i = 0; i < BASE_DATASETS; i++) {
                datasets[i].data = []
            }
            this.controllerOutput = []
        },
        setSimulationResults(results: SimulationResult[]) {
            for (const result of results) {
                this._pushRecord(result)
            }
            // show exercise intensity only if there is exercise
            for (const index of HIDDEN_DATASETS) {
                this.chart.setDatasetVisibility(index, false)
            }
            this.update()
        },
        _pushRecord(result: SimulationResult) {
            const t = result.t
            const c = result.c
            const u = result.u
            const log = result.log
            const datasets = this.chart.data.datasets
            if (typeof c.iir !== "undefined") {
                datasets[0].data.push({ x: t.valueOf(), y: c.iir })
            }
            if (typeof c.ibolus !== "undefined" && c.ibolus > 0) {
                datasets[1].data.push({ x: t.valueOf(), y: c.ibolus })
            }
            if (typeof log?.IOB !== "undefined") {
                datasets[2].data.push({ x: t.valueOf(), y: log.IOB })
            }
            if (typeof log !== "undefined" &&
                ((log?.debug?.length || 0) > 0 || (log?.reason?.length || 0) > 0)) {
                this.controllerOutput.push({ t, log })
            }
            datasets[3].data.push({ x: t.valueOf(), y: u.meal || NaN })
            datasets[4].data.push({ x: t.valueOf(), y: u.carbs || 0 })
            datasets[5].data.push({ x: t.valueOf(), y: u.exercise || 0 })
            datasets[6].data.push({ x: t.valueOf(), y: (u.iir || 0) > 10 ? NaN : (u.iir || 0)  })
        },
        /** shows long-acting injections (in U) from logged patient data */
        setLongActingInjections(events: PatientEvent[]) {
            const datasets = this.chart.data.datasets
            datasets[LONG_ACTING_DATASET].data = events.map(
                (event) => ({ x: event.time.valueOf(), y: event.value }))
            this.updateLongActingScale()
        },
        /**
         * Switches between showing a single day (filled markers, solid line)
         * and comparing the logged day with what-if runs: the main simulation
         * is then labelled as the logged day and drawn with hollow markers
         * and a dashed line, while what-if runs use filled markers.
         * @param {boolean} active - whether what-if runs are compared
         */
        setComparison(active: boolean) {
            const datasets = <ChartDataset<"line">[]>this.chart.data.datasets
            datasets[0].label = this.$t(active ? "loggedIir" : "iir")
            datasets[0].borderDash = active ? LOGGED_DAY_DASH : []
            datasets[IOB_DATASET].label = this.$t(active ? "loggedIob" : "iob")
            datasets[IOB_DATASET].borderDash = active ? LOGGED_DAY_DASH : []
            const markers: [number, string, string, string][] = [
                [1, "ibolus", "loggedIbolus", colors['THURed']],
                [3, "totalmeal", "loggedMeal", colors['THUDarkBlue']],
                [LONG_ACTING_DATASET, "longacting", "loggedLongacting",
                    colors['THUGreen']],
            ]
            for (const [i, label, loggedLabel, color] of markers) {
                datasets[i].label = this.$t(active ? loggedLabel : label)
                datasets[i].backgroundColor = active ? HOLLOW : color
                datasets[i].borderColor = active ? color : colors['THUAnthrazit']
                datasets[i].borderWidth = active ? 2 : 1
            }
            this.update()
        },
        /**
         * Adds the treatment of a what-if run (basal line and filled markers
         * for boluses, meals and long-acting injections), unless a run with
         * the same key is already shown.
         * @param {SimulationResult[]} results - results of the run
         * @param {PatientEvent[]} events - events of the run
         * @param {string} key - identifies the run (as in the glucose chart)
         * @param {string} label - name of the run (e.g. what-if 2)
         */
        addRun(results: SimulationResult[], events: PatientEvent[],
            key: string, label: string) {
            if (this.runKeys().includes(key)) {
                return
            }
            const point = (t: Date, y: number) => ({ x: t.valueOf(), y })
            const tag = { runKey: key }
            const runDatasets = <RunDataset[]><unknown>[
                {
                    ...tag, runRole: "basal",
                    type: "line", yAxisID: 'y', label,
                    data: results.filter((r) => typeof r.c.iir !== "undefined")
                        .map((r) => point(r.t, r.c.iir!)),
                    borderColor: colors['THURed'],
                    borderWidth: 2,
                    stepped: "before",
                },
                {
                    ...tag, runRole: "bolus",
                    type: "scatter", yAxisID: 'y', label: `${label}: quick-acting insulin`,
                    data: results.filter((r) => (r.c.ibolus ?? 0) > 0)
                        .map((r) => point(r.t, r.c.ibolus!)),
                    backgroundColor: colors['THURed'],
                    borderColor: colors['THUAnthrazit'],
                    radius: 10, pointStyle: "triangle", rotation: 180,
                },
                {
                    ...tag, runRole: "meal",
                    type: "scatter", yAxisID: 'yG', label: `${label}: meal`,
                    data: results.filter((r) => (r.u.meal ?? 0) > 0)
                        .map((r) => point(r.t, r.u.meal!)),
                    backgroundColor: colors['THUDarkBlue'],
                    borderColor: colors['THUAnthrazit'],
                    radius: 10, pointStyle: "triangle",
                },
                {
                    ...tag, runRole: "longacting",
                    type: "scatter", yAxisID: 'yLong',
                    label: `${label}: background injection`,
                    data: events.filter((e) => e.type === "longacting")
                        .map((e) => point(e.time, e.value)),
                    backgroundColor: colors['THUGreen'],
                    borderColor: colors['THUAnthrazit'],
                    radius: 10, pointStyle: "rectRot",
                },
                {
                    ...tag, runRole: "iob",
                    type: "line", yAxisID: 'y',
                    label: `${label}: insulin on board`,
                    data: results.filter((r) => typeof r.log?.IOB !== "undefined")
                        .map((r) => point(r.t, r.log!.IOB!)),
                    borderColor: IOB_COLOR,
                    backgroundColor: IOB_COLOR,
                    borderWidth: 2,
                    pointRadius: 0,
                },
            ]
            this.chart.data.datasets.push(...runDatasets)
            this.updateLongActingScale()
        },
        /** returns the keys of the what-if runs in the order they were added */
        runKeys(): string[] {
            const keys: string[] = []
            for (const dataset of this.chart.data.datasets) {
                const key = (<RunDataset>dataset).runKey
                if (key && !keys.includes(key)) keys.push(key)
            }
            return keys
        },
        /** shows or hides all datasets of a what-if run */
        setRunVisible(key: string, visible: boolean) {
            this.chart.data.datasets.forEach((dataset, i) => {
                if ((<RunDataset>dataset).runKey === key) {
                    this.chart.setDatasetVisibility(i, visible)
                }
            })
            this.update()
        },
        /**
         * Applies the visibility of runs (as in the glucose chart) and draws
         * the latest run's basal line solid, others with their own pattern.
         * @param {Record<string, boolean>} visibility - visibility by run key
         * @param {string | null} latestKey - key of the latest run
         */
        syncRuns(visibility: Record<string, boolean>, latestKey: string | null) {
            const keys = this.runKeys()
            this.chart.data.datasets.forEach((dataset, i) => {
                const run = <RunDataset & ChartDataset<"line">>dataset
                if (!run.runKey) return
                this.chart.setDatasetVisibility(i, visibility[run.runKey] ?? true)
                if (run.runRole === "basal" || run.runRole === "iob") {
                    run.borderDash = run.runKey === latestKey
                        ? [] : runDash(keys.indexOf(run.runKey))
                }
            })
            this.update()
        },
        /** removes all what-if runs */
        clearRuns() {
            this.chart.data.datasets = this.chart.data.datasets
                .slice(0, BASE_DATASETS)
            this.setComparison(false)
        },
        /** places long-acting markers near the top of the chart */
        updateLongActingScale() {
            const datasets = this.chart.data.datasets
            const doses = datasets
                .filter((dataset) => (<{ yAxisID?: string }>dataset).yAxisID === 'yLong')
                .flatMap((dataset) => dataset.data.map((p) => (<Point>p).y ?? 0))
            this.chart.options.scales!.yLong!.max = 1.2 * Math.max(0, ...doses)
            this.update()
        },
        /** shows the given period (the same as in the glucose chart) */
        setTimeRange(range: { t0: Date, tmax: Date } | null) {
            const x = this.chart.options.scales!.x!
            x.min = range?.t0.valueOf()
            x.max = range?.tmax.valueOf()
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
            this.chart.update()
        },
    },
})
</script>


<template>
    <AccordionBox :title="$t('title')" :initial="true">
        <div class="canvas-chart">
            <canvas :id="canvasid" role="img" :aria-label="description"></canvas>
        </div>
        <ChartLineToggles :lines="lines" @toggle="toggleLine" />
    </AccordionBox>
</template>


<i18n locale="en">
{
	"title":		"Insulin and food",
	"iir":			"Background insulin (units an hour)",
	"longacting":	"Background insulin injection (units)",
	"loggedIir":	"Original background insulin (units an hour)",
	"loggedIbolus":	"Original quick-acting insulin (units)",
	"loggedMeal":	"Original meal (grams of carbs)",
	"loggedLongacting":	"Original background injection (units)",
	"ibolus":		"Quick-acting insulin (units)",
    "pumpoutput":   "Insulin pump output (units an hour)",
	"iob":			"Quick-acting insulin on board (units)",
	"loggedIob":	"Original quick-acting insulin on board (units)",
	"totalmeal":	"Meal (grams of carbs)",
	"carbspermin":	"Carbs being absorbed (grams a minute)",
	"exIntensity":	"Exercise effort (%)",
}
</i18n>
