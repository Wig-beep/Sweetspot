<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, toRaw } from 'vue'
import { defaults } from 'chart.js'
import ControllerSelection from './ControllerSelection.vue'
import VirtualPatientSelection from './VirtualPatientSelection.vue'
import SensorSelection from './SensorSelection.vue'
import ActuatorSelection from './ActuatorSelection.vue'
import MealTable from './MealTable.vue'
import ExerciseTable from './ExerciseTable.vue'
import ChartGlucose from './ChartGlucose.vue'
import ChartInsulinCarbs from './ChartInsulinCarbs.vue'
import SimulationOptionsConfig from './SimulationOptionsConfig.vue'
import { SimulationResult } from '../../types/SimulationResult.js'
import Patient, { PatientProfile } from '../../types/Patient.js'
import Controller from '../../types/Controller.js'
import Sensor from '../../types/Sensor.js'
import Actuator from '../../types/Actuator.js'
import Exercise from '../../types/Exercise.js'
import Meal from '../../types/Meal.js'
import Simulator, { SimulatorOptions } from '../../core/Simulator.js'
import { simulateEvents } from '../../common/SimulateEvents.js'
import { getPatientDataTimeSpan } from '../../common/PatientDataTimeSpan.js'
import PatientEvent from '../../types/PatientEvent.js'
import { parsePatientEventsCSV } from '../../common/PatientEvents.js'
import PatientTimeline from './PatientTimeline.vue'
import ScenarioComparison from './ScenarioComparison.vue'
import TeachingScenarioPanel from './TeachingScenarioPanel.vue'
import {
    getTeachingScenarios,
    TeachingScenario,
    WhatIf
} from '../../common/TeachingScenarios.js'
import { computeGlucoseMetrics, GlucoseMetrics } from '../../common/GlucoseMetrics.js'
import {
    DescribedDay,
    describeGlucose,
    describeInsulin
} from '../../common/ChartDescriptions.js'

// prepare simulator
const sim = new Simulator()

export default defineComponent({

    beforeMount() {
        // set default options for Chart
        defaults.maintainAspectRatio = false
        defaults.responsive = true
        defaults.animation = false
        defaults.normalized = true

        defaults.elements.point.pointStyle = 'line'
        defaults.elements.point.radius = 0

        defaults.plugins.legend.labels.usePointStyle = true

        defaults.interaction.mode = 'nearest'
        defaults.interaction.axis = 'xy'
        defaults.interaction.intersect = false

        defaults.parsing = false
    },

    components: {
        ControllerSelection,
        VirtualPatientSelection,
        SensorSelection,
        ActuatorSelection,
        MealTable,
        ExerciseTable,
        SimulationOptionsConfig,
        ChartGlucose,
        ChartInsulinCarbs,
        PatientTimeline,
        ScenarioComparison,
        TeachingScenarioPanel,
    },

    created() {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key == 'Enter') {
                this.run()
            }
        })
    },

    data() {
        return {
            patient: {} as Patient,
            patientProfile: {} as PatientProfile,
            controller: {} as Controller,
            sensor: {} as Sensor,
            actuator: {} as Actuator,
            meals: [] as Meal[],
            exerciseUnits: [] as Exercise[],
            options: {} as SimulatorOptions,
            originalPatientEvents: null as PatientEvent[] | null,  // never mutated — baseline for comparison
            patientEvents: null as PatientEvent[] | null,          // working copy the timeline will edit
            csvFileName: '' as string,
            /** problem with the last CSV file, shown next to the upload */
            csvError: '' as string,
            /** teaching scenarios (on the current day) */
            scenarios: getTeachingScenarios(new Date()),
            /** id of the loaded teaching scenario, if any */
            activeScenarioId: null as string | null,
            /** whether exercise was simulated with the exercise model */
            usedExerciseModel: false,
            /** metrics of the latest simulation (what-if day, if edited) */
            metrics: null as GlucoseMetrics | null,
            /** name of the latest what-if, if the timeline has been edited */
            whatIfName: '' as string,
            /** metrics of the logged day, if the timeline has been edited */
            baselineMetrics: null as GlucoseMetrics | null,
        }
    },

    async mounted() {
        // wait until all elements of simulation have been initialized
        const isEmpty = (o: any) => (typeof o.update !== "function")
        while (isEmpty(this.getPatient()) || isEmpty(this.getController()) ||
            isEmpty(this.getSensor()) || isEmpty(this.getActuator())) {
            await new Promise(r => setTimeout(r, 10))
        }
        // run simulation to populate graphs
        console.log("PROGRAM READY")
        //this.run()
    },
    computed: {
        /** time span covered by the logged and the edited patient data */
        simulationSpan(): { t0: Date, tmax: Date } | undefined {
            if (!this.patientEvents) {
                return undefined
            }
            return getPatientDataTimeSpan([
                ...this.patientEvents,
                ...(this.originalPatientEvents ?? []),
            ])
        },
        /** days summarised in the text alternatives of the charts */
        describedDays(): DescribedDay[] {
            if (!this.metrics) {
                return []
            }
            if (this.baselineMetrics) {
                return [
                    { name: "Logged day", metrics: this.baselineMetrics },
                    { name: `What-if (${this.whatIfName})`, metrics: this.metrics },
                ]
            }
            const name = this.patientEvents ? "Logged day" : "Simulated day"
            return [{ name, metrics: this.metrics }]
        },
        /** short announcement for screen readers after each simulation */
        statusMessage(): string {
            const [first, second] = this.describedDays
            if (!first) {
                return ""
            }
            const tir = (d: DescribedDay) =>
                `${d.name}: ${Math.round(d.metrics.timeInRange)}% in range, `
                + `${Math.round(d.metrics.timeBelowRange)}% below 3.9.`
            return "Simulation updated. " + tir(first) + (second ? " " + tir(second) : "")
        },
        glucoseDescription(): string {
            return describeGlucose(this.describedDays)
        },
        insulinDescription(): string {
            return describeInsulin(this.describedDays)
        },
        /** whether the timeline differs from the logged day */
        isEdited(): boolean {
            return JSON.stringify(this.patientEvents)
                !== JSON.stringify(this.originalPatientEvents)
        },
    },
    methods: {
            async onCsvFileSelected(event: Event): Promise<void> {
                const input = event.target as HTMLInputElement
                const file = input.files?.[0]

                if (!file) {
                    return
                }

                console.log("CSV LOADED:", file.name)

                this.csvFileName = file.name
                this.activeScenarioId = null

                const csvText = await file.text()

                try {
                    const parsed = parsePatientEventsCSV(csvText)

                    this.originalPatientEvents = structuredClone(parsed)
                    this.patientEvents = parsed
                    // what-ifs of previously loaded data do not apply any more
                    this.chartGlucose().clearRuns()
                    this.chartInsulinCarbs().clearRuns()

                    console.log("CSV PARSED:", parsed)
                } catch (err) {
                    this.csvError =
                        `Could not load ${file.name}: ${(err as Error).message}`
                    input.value = ''
                    return
                }
                this.csvError = ''

                // Allows the user to select the same file again later
                input.value = ''

                this.run()
            },
        run(): void {
            this.resetCharts()

            const events = toRaw(this.patientEvents)
            const original = toRaw(this.originalPatientEvents)
            this.usedExerciseModel = false
            const chartGlucose = this.chartGlucose()
            const chartInsulinCarbs = this.chartInsulinCarbs()

            // with patient data, the logged day is always shown; an edited
            // timeline is simulated as a what-if on top of it
            const loggedDay = original ? this.simulate(original) : null
            const isWhatIf = loggedDay !== null && this.isEdited
            const results = (loggedDay && !isWhatIf)
                ? loggedDay : this.simulate(events)

            // propagate results to charts; with patient data, the charts'
            // main simulation is the logged day and what-ifs are added to it
            this.propagateSimulationResults(loggedDay ?? results)
            chartGlucose.setLoggedDay(loggedDay)
            if (isWhatIf) {
                const key = JSON.stringify(events)
                chartGlucose.addRun(results, key, this.$t("whatif"),
                    this.scenarioWhatIfLabel(key))
                chartInsulinCarbs.addRun(results, events ?? [], key,
                    chartGlucose.getRunLabel(key))
                this.whatIfName = chartGlucose.getRunLabel(key)
            }
            else if (loggedDay) {
                chartGlucose.highlightRun(null)
            }
            else {
                // without patient data, every run is kept as a new curve
                chartGlucose.addRun(results, String(Date.now()),
                    this.$t("simulated"))
            }
            const mainEvents = original ?? events ?? []
            chartGlucose.setMeasuredGlucose(
                mainEvents.filter((event) => event.type === "glucose"))
            chartInsulinCarbs.setLongActingInjections(
                mainEvents.filter((event) => event.type === "longacting"))
            this.syncInsulinRuns()

            this.metrics = computeGlucoseMetrics(results)
            this.baselineMetrics = (isWhatIf && loggedDay)
                ? computeGlucoseMetrics(loggedDay) : null
        },
        /** loads a teaching scenario as the logged day */
        loadScenario(scenario: TeachingScenario): void {
            const events = structuredClone(toRaw(scenario.events))
            this.originalPatientEvents = structuredClone(events)
            this.patientEvents = events
            this.csvFileName = ''
            this.csvError = ''
            this.activeScenarioId = scenario.id
            this.chartGlucose().clearRuns()
            this.chartInsulinCarbs().clearRuns()
            this.run()
        },
        /** applies a what-if of the loaded teaching scenario */
        applyWhatIf(whatIf: WhatIf): void {
            this.patientEvents = structuredClone(toRaw(whatIf.events))
            this.run()
        },
        /**
         * Returns the name of the scenario what-if with the given events
         * (as JSON), if the timeline matches one.
         */
        scenarioWhatIfLabel(eventsJSON: string): string | undefined {
            const scenario = this.scenarios.find(
                (s) => s.id === this.activeScenarioId)
            return scenario?.whatIfs.find((w) =>
                JSON.stringify(w.events) === eventsJSON)?.label
        },
        chartGlucose(): InstanceType<typeof ChartGlucose> {
            return <InstanceType<typeof ChartGlucose>>this.$refs.chartGlucose
        },
        chartInsulinCarbs(): InstanceType<typeof ChartInsulinCarbs> {
            return <InstanceType<typeof ChartInsulinCarbs>>
                this.$refs.chartInsulinCarbs
        },
        /**
         * Shows the what-if runs on the insulin chart as they are shown on
         * the glucose chart.
         */
        syncInsulinRuns(): void {
            const chartGlucose = this.chartGlucose()
            const chartInsulinCarbs = this.chartInsulinCarbs()
            const visibility = chartGlucose.getRunVisibility()
            chartInsulinCarbs.setComparison(this.patientEvents !== null &&
                Object.keys(visibility).length > 0)
            chartInsulinCarbs.syncRuns(visibility, chartGlucose.latestKey)
        },
        /** a what-if run was shown or hidden in the insulin chart's legend */
        insulinRunVisibilityChanged(key: string, visible: boolean): void {
            this.chartGlucose().setRunVisible(key, visible)
            this.syncInsulinRuns()
        },
        /**
         * Runs a simulation.
         * @param {PatientEvent[] | null} events - logged events to replay, or
         *      null to use the selected controller and meals
         * @returns {SimulationResult[]} results
         */
        simulate(events: PatientEvent[] | null): SimulationResult[] {
            if (events) {
                // replay logged doses, meals and exercise over the period
                // covered by the patient data
                const { results, usedExerciseModel } = simulateEvents(events,
                    this.getPatient(), this.getSensor(),
                    { ...this.getOptions(), ...this.simulationSpan }, sim)
                this.usedExerciseModel ||= usedExerciseModel
                return results
            }
            sim.setPatient(this.getPatient())
            sim.setController(this.getController())
            sim.setMeals(this.getMeals())
            sim.setExerciseUnits(this.getExerciseUnits())
            sim.setOptions(this.getOptions())
            sim.setSensor(this.getSensor())
            sim.setActuator(this.getActuator())
            return sim.runSimulation()
        },
        getController(): Controller {
            return <Controller>toRaw(this.controller)
        },
        getPatient(): Patient {
            return <Patient>toRaw(this.patient)
        },
        getSensor(): Sensor {
            return <Sensor>toRaw(this.sensor)
        },
        getActuator(): Actuator {
            return <Actuator>toRaw(this.actuator)
        },
        getMeals(): Meal[] {
            return toRaw(this.meals)
        },
        getExerciseUnits(): Exercise[] {
            return toRaw(this.exerciseUnits)
        },
        getOptions(): Object {
            const options = <InstanceType<typeof SimulationOptionsConfig>>
                this.$refs.options
            return toRaw(options.getParameterValues())
        },
        controllerChanged(newController: Controller): void {
            if (typeof newController !== "undefined") {
                console.log("Controller changed")
                console.log(newController)
                this.controller = newController
            }
        },
        patientChanged(newPatient: Patient): void {
            if (typeof newPatient !== "undefined") {
                console.log("Patient changed")
                this.patient = newPatient
                const profile = newPatient?.getPatientProfile?.()
                if (typeof profile !== "undefined") {
                    this.patientProfile = profile
                }
            }
        },
        sensorChanged(newSensor: Sensor): void {
            if (typeof newSensor !== "undefined") {
                console.log("Sensor changed")
                console.log(newSensor)
                this.sensor = newSensor
            }
        },
        actuatorChanged(newActuator: Actuator): void {
            if (typeof newActuator !== "undefined") {
                console.log("Actuator changed")
                this.actuator = newActuator
            }
        },
        mealsChanged(newMeals: Meal[]) {
            this.meals = newMeals
        },
        exercisesChanged(newExercises: Exercise[]) {
            this.exerciseUnits = newExercises
        },
        optionsChanged(newOptions: SimulatorOptions) {
            if (typeof newOptions !== "undefined") {
                console.log("Options changed")
                this.options = newOptions
            }
        },
        resetCharts() {
            for (const chart in this.$refs) {
                (<any>this.$refs[chart]).reset?.()
            }
        },
        propagateSimulationResults(simResults: SimulationResult[]) {
            for (const chart in this.$refs) {
                (<any>this.$refs[chart]).setSimulationResults?.(simResults) 
            }
        },
        /** callback when mouse hovers over medication chart */
        controllerDataHover(t0: Date, data: Object): void {
            if (typeof data === "undefined") {
                return
            }
            for (const chartName in this.$refs) {
                const chart = <any>this.$refs[chartName]
                chart.controllerDataHover?.(t0, toRaw(data))
            }
        },
        timelineChanged(events: PatientEvent[]): void {
            if (!this.patientEvents) {
                return
            }
            this.patientEvents = events
            this.run()
        },
        /** discards all edits of the timeline */
        resetToLoggedDay(): void {
            if (!this.originalPatientEvents) {
                return
            }
            this.patientEvents = structuredClone(toRaw(this.originalPatientEvents))
            this.run()
        },
    },
})
</script>


<template>
    <div class="lt1-container">
        <div class="box lt1-controls">
            <h2>{{ $t("Patient Input") }}</h2>
            <div style="display: none;">    
                <ControllerSelection @controllerChanged="controllerChanged" 
                    :patientProfile="patientProfile" ref="controller" />
                <SensorSelection @valueChanged="sensorChanged" />
                <ActuatorSelection @valueChanged="actuatorChanged" />
            </div>
            
            <TeachingScenarioPanel :scenarios="scenarios"
                :activeId="activeScenarioId"
                @load="loadScenario" @whatIf="applyWhatIf" />

            <div class="lt1-csv-input">
                <label for="csvUpload">Or load patient data CSV:</label>
                <input type="file" id="csvUpload" accept=".csv" @change="onCsvFileSelected" />
                <span v-if="csvFileName && !csvError">Loaded: {{ csvFileName }}</span>
                <p v-if="csvError" class="csv-error" role="alert">{{ csvError }}</p>
                <div v-if="simulationSpan">
                    Simulating {{ simulationSpan.t0.toLocaleString() }}
                    to {{ simulationSpan.tmax.toLocaleString() }}
                </div>
                <div v-if="usedExerciseModel" class="exercise-note">
                    Exercise is simulated with the Deichmann 2021 virtual
                    patient, as the selected one does not respond to exercise.
                </div>
            </div>

            <VirtualPatientSelection @patientChanged="patientChanged" />

            <PatientTimeline
                v-if="patientEvents"
                :events="patientEvents"
                @timelineChanged="timelineChanged"
            />
            <button v-if="isEdited" @click="resetToLoggedDay">
                Reset to logged day
            </button>

            <div style="display: none;">    
            <MealTable v-if='options.t0' :t0="options.t0" @mealsChanged="mealsChanged" ref="meals" />
            <ExerciseTable v-if='options.t0' :t0="options.t0" @exercisesChanged="exercisesChanged" />
            <SimulationOptionsConfig @valueChanged="optionsChanged" ref="options" />
            </div>
            <div style="text-align:center;">
                <input type="button" id="startbutton" :value="$t('run')" @click="run" v-tooltip="{
                    global: true,
                    theme: {
                        placement: 'bottom',
                        width: 'fit-content',
                        padding: '2rem'
                    },
                }">
                <br />
                <!--<div style="font-size: 0.8em;">
                    {{ $t("shortcut") }}
                </div>-->
            </div>
        </div>
        <div class="box lt1-results">
            <h2>{{ $t("results") }}</h2>
            <p class="visually-hidden" role="status">{{ statusMessage }}</p>
            <ChartGlucose ref="chartGlucose" :description="glucoseDescription"
                @runVisibilityChanged="syncInsulinRuns" />
            <ChartInsulinCarbs ref="chartInsulinCarbs" @selectLog="controllerDataHover"
                :description="insulinDescription"
                @runVisibilityChanged="insulinRunVisibilityChanged" />
            <ScenarioComparison :metrics="metrics" :baseline="baselineMetrics"
                :isLoggedDay="patientEvents !== null" />
        </div>
    </div>
</template>


<style lang="css">
.csv-error {
    color: #b00020;
    font-weight: bold;
    margin: 4px 0;
}

.exercise-note {
    font-size: 0.8rem;
    font-style: italic;
    opacity: 0.8;
}
</style>


<i18n locale="en">
{
	"settings": 	"Settings",
	"run": 			"run simulation",
	"results":		"Results",
	"whatif":		"what-if",
	"simulated":	"simulated glucose",
    "shortcut":     "or press Ctrl+Enter",
}
</i18n>
<i18n locale="de">
{
	"settings": 	"Einstellungen",
	"run": 			"Simulation starten",
	"results":		"Ergebnisse",
	"whatif":		"Was-wäre-wenn",
	"simulated":	"Simulierte Glukose",
    "shortcut":     "oder Strg+Eingabe drücken"
}
</i18n>
