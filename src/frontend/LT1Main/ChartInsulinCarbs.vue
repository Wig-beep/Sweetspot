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
import AccordionBox from './AccordionBox.vue'

/** index of the dataset showing exercise intensity */
const EXERCISE_DATASET = 5
/** index of the dataset showing long-acting injections */
const LONG_ACTING_DATASET = 7
/**
 * number of datasets showing the main simulation (the logged day, if patient
 * data is loaded); datasets of what-if runs follow
 */
const BASE_DATASETS = 8

/** colour of filled markers in a comparison: hollow */
const HOLLOW = "rgba(0,0,0,0)"

/** dataset of a what-if run, tagged with the run and its role */
type RunDataset = ChartDataset & {
    runKey: string
    runRole: "basal" | "bolus" | "meal" | "longacting"
}

export default defineComponent({
    emits: ["selectLog", "runVisibilityChanged"],
    props: {
        /** text alternative of the chart */
        description: { type: String, default: "Insulin and carbs chart" },
    },
    components: {
        AccordionBox
    },
    data() {
        return {
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
                        type: "scatter",
                        data: [],
                        yAxisID: 'y',
                        label: this.$t("iob"),
                        borderColor: colors['THUGreen'],
                        backgroundColor: colors['THUGreen'],
                        radius: 2,
                        pointStyle: "circle"
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
                        title: { display: true, text: "insulin (units)" },
                        min: 0,
                        ticks: { stepSize: 1 },
                        suggestedMax: 2,
                    },
                    yG: {
                        title: { display: true, text: "carbs (grams)" },
                        position: 'right',
                        min: 0,
                        suggestedMax: 30,
                        ticks: { stepSize: 10 },
                        grid: { drawOnChartArea: false },
                    },
                    // long-acting doses are much larger than rates and
                    // boluses, so they get their own (hidden) axis
                    yLong: {
                        display: false,
                        min: 0,
                    },
                    yEx: {
                        // only shown if there is exercise
                        display: 'auto',
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
                                if (index === EXERCISE_DATASET) {
                                    return !item.hidden
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
            const hasExercise = results.some((r) => (r.u.exercise ?? 0) > 0)
            this.chart.setDatasetVisibility(EXERCISE_DATASET, hasExercise)
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
                if (run.runRole === "basal") {
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
    </AccordionBox>
</template>


<i18n locale="en">
{
	"title":		"Insulin and food",
	"iir":			"background insulin (units an hour)",
	"longacting":	"background insulin injection (units)",
	"loggedIir":	"original background insulin (units an hour)",
	"loggedIbolus":	"original quick-acting insulin (units)",
	"loggedMeal":	"original meal (grams of carbs)",
	"loggedLongacting":	"original background injection (units)",
	"ibolus":		"quick-acting insulin (units)",
    "pumpoutput":   "insulin pump output (units an hour)",
	"iob":			"insulin on board (units)",
	"totalmeal":	"meal (grams of carbs)",
	"carbspermin":	"carbs being absorbed (grams a minute)",
	"exIntensity":	"exercise effort (%)",
}
</i18n>
<i18n locale="de">
{
	"title": 		"Insulindosierung und Mahlzeiten",
	"iir":			"Basalinsulin in U/h",
	"longacting":	"Langzeitinsulin in U",
	"loggedIir":	"Protokolliertes Basalinsulin in U/h",
	"loggedIbolus":	"Protokollierter Bolus in U",
	"loggedMeal":	"Protokollierte Mahlzeit in g",
	"loggedLongacting":	"Protokolliertes Langzeitinsulin in U",
	"ibolus":		"Insulinbolus in U",
    "pumpoutput":   "Insulinabgabe der Pumpe in U/h",
	"iob":			"Berechnetes IOB in U",
	"totalmeal":	"Gesamte Mahlzeit in g",
	"carbspermin":	"Aufnahme in g/min",
	"exIntensity":	"Sportintensität in %",
}
</i18n>
