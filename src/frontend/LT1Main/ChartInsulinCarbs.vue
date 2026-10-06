<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { ChartDatasetCustomTypesPerDataset } from 'chart.js'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { defineComponent, toRaw } from 'vue'
import { ControllerInternals } from '../../types/Controller.js'
import PatientEvent from '../../types/PatientEvent.js'
import { SimulationResult } from '../../types/SimulationResult.js'
import colors from '../util/Colors.js'
import AccordionBox from './AccordionBox.vue'

/** index of the dataset showing long-acting injections */
const LONG_ACTING_DATASET = 7

export default defineComponent({
    emits: ["selectLog"],
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
                        title: { display: true, text: "U, U/h" },
                        min: 0,
                        ticks: { stepSize: 1 },
                        suggestedMax: 2,
                    },
                    yG: {
                        title: { display: true, text: "g, g/min" },
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
                        labels: {
                            // no legend for long-acting insulin if there is none
                            filter: (item, data) =>
                                item.datasetIndex !== LONG_ACTING_DATASET ||
                                data.datasets[LONG_ACTING_DATASET].data.length > 0
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
    },
    methods: {
        reset() {
            let datasets = this.chart.data.datasets
            for (let i = 0; i < datasets.length; i++) {
                datasets[i].data = []
            }
            this.controllerOutput = []
        },
        setSimulationResults(results: SimulationResult[]) {
            for (const result of results) {
                this._pushRecord(result)
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
            const scales = this.chart.options.scales!
            // place markers near the top of the chart
            scales.yLong!.max = 1.2 * Math.max(0, ...events.map((e) => e.value))
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
            <canvas :id="canvasid"></canvas>
        </div>
    </AccordionBox>
</template>


<i18n locale="en">
{
	"title":		"Insulin dosage and carb intake",
	"iir":			"basal insulin in U/h",
	"longacting":	"long-acting injection in U",
	"ibolus":		"insulin bolus in U",
    "pumpoutput":   "insulin pump output in U/h",
	"iob":			"calculated IOB in U",
	"totalmeal":	"total meal in g",
	"carbspermin":	"intake in g/min",
	"exIntensity":	"exercise intensity in %",
}
</i18n>
<i18n locale="de">
{
	"title": 		"Insulindosierung und Mahlzeiten",
	"iir":			"Basalinsulin in U/h",
	"longacting":	"Langzeitinsulin in U",
	"ibolus":		"Insulinbolus in U",
    "pumpoutput":   "Insulinabgabe der Pumpe in U/h",
	"iob":			"Berechnetes IOB in U",
	"totalmeal":	"Gesamte Mahlzeit in g",
	"carbspermin":	"Aufnahme in g/min",
	"exIntensity":	"Sportintensität in %",
}
</i18n>
