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
import {
    glucoseColorLine,
    glucoseColorLineSegment
} from '../util/ChartGlucoseColor.js'
import AccordionBox from './AccordionBox.vue'

/** number of datasets that are always present (prediction, measured) */
const FIXED_DATASETS = 2

export default defineComponent({
    components: {
        AccordionBox
    },
    data() {
        return {
            preserveOldCurves: true,
            // datasets 0 (prediction) and 1 (measured glucose) are fixed
            currentDatasetID: FIXED_DATASETS,
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
                    legend: {
                        labels: {
                            // no legend for controller prediction and
                            // for measured glucose if there is none
                            filter: (item, data) => {
                                const index = item.datasetIndex || 0
                                return index > 1 || (index === 1 &&
                                    data.datasets[1].data.length > 0)
                            }
                        }
                    },
                },
            },
        })
    },
    methods: {
        reset() {
            const chartGlucose = this.chart
            let datasets = chartGlucose.data.datasets
            // remove prediction data
            datasets[0].data = []
            if (this.preserveOldCurves) {
                if (datasets.length > this.currentDatasetID) {
                    // make old curve thinner
                    datasets[this.currentDatasetID - 1].borderWidth = 0.5
                    const pointDataset: any = datasets[this.currentDatasetID]	// todo
                    pointDataset.pointRadius = 1
                }
            }
            else {
                // remove all but first (prediction)
                chartGlucose.data.datasets = datasets.slice(0, FIXED_DATASETS)
                datasets = chartGlucose.data.datasets
            }
            // create new curve
            const id = datasets.length - FIXED_DATASETS + 1
            datasets.push({
                type: "line",
                label: `Glucose Result ${id}`, //label: `#${id}: ` + this.$t("actual"),
                tension: 0.5,
                data: [],
                segment: {
                    borderColor: glucoseColorLineSegment
                },
            })
            /*datasets.push({
                type: "line",
                label: `#${id}: CGM`,
                showLine: false,
                pointRadius: 5,
                pointStyle: "circle",
                pointBorderColor: glucoseColorLine,
                pointBackgroundColor: glucoseColorLine,
                data: [],
            })*/
            this.currentDatasetID = datasets.length
        },
        setSimulationResults(results: SimulationResult[]) {
            for (const result of results) {
                this._pushRecord(result)
            }
            this.update()
        },
        _pushRecord(result: SimulationResult) {
            const datasets = this.chart.data.datasets
            // add to glucose plot (most recent simulation)
            datasets[this.currentDatasetID - 1].data
                .push({ x: result.t.valueOf(), y: toMmolL(result.y.Gp) })
            /*if (typeof result.s.CGM !== "undefined") {
                datasets[this.currentDatasetID].data
                    .push({ x: result.t.valueOf(), y: result.s.CGM })
            }
            else if (typeof result.s.SMBG !== "undefined") {
                datasets[this.currentDatasetID].data
                    .push({ x: result.t.valueOf(), y: result.s.SMBG })
            }*/
        },
        /** shows measured glucose (in mmol/L) from logged patient data */
        setMeasuredGlucose(events: PatientEvent[]) {
            this.chart.data.datasets[1].data = events.map(
                (event) => <Point>{ x: event.time.valueOf(), y: event.value })
            this.update()
        },
        update() {
            const config = this.chart.config
            // adapt scale only to real glucose diagram, not predictions
            const tmax = <Point>this.chart.data
                .datasets[this.currentDatasetID - 1].data.at(-1)
            if (typeof config.options === "undefined") {
                config.options = {}
            }
            if (typeof config.options.scales === "undefined") {
                config.options.scales = {}
            }
            if (typeof config.options.scales.x === "undefined") {
                config.options.scales.x = {}
            }
            config.options.scales.x.max = tmax?.x || 0
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
	"preserveOldCurves": "preserve old curves",
}
</i18n>
<i18n locale="de">
{
	"title": "Glukosekonzentration",
	"actual": "Tatsächliche Glukosekonzentration",
	"prediction": "Prädiktion des Algorithmus",
	"measured": "Gemessene Glukose",
	"preserveOldCurves": "Alte Kurven beibehalten",
}
</i18n>
