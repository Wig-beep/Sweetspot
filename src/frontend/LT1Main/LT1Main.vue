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
import { hasExercise, simulateEvents } from '../../common/SimulateEvents.js'
import { friendlyDateTime } from '../util/FriendlyDate.js'
import { getPatientDataTimeSpan } from '../../common/PatientDataTimeSpan.js'
import PatientEvent from '../../types/PatientEvent.js'
import { getExercisesFromEvents, parsePatientEventsCSV } from '../../common/PatientEvents.js'
import { eventsForDay, getDays } from '../../common/PatientDays.js'
import PatientTimeline from './PatientTimeline.vue'
import ScenarioComparison from './ScenarioComparison.vue'
import TeachingScenarioPanel from './TeachingScenarioPanel.vue'
import AccordionBox from './AccordionBox.vue'
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

/** media query of the layout with the results below the settings */
const PHONE_LAYOUT = "(max-width: 879px)"

/** key in local storage remembering that the introduction was hidden */
const INTRO_SEEN_KEY = "sweetspot-intro-seen"

/** whether the introduction was hidden on an earlier visit */
function introSeen(): boolean {
    try {
        return localStorage.getItem(INTRO_SEEN_KEY) === "1"
    } catch {
        return false
    }
}

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

        // readable chart text in the app's font
        defaults.font.family = 'Arial, "Helvetica Neue", Helvetica, sans-serif'
        defaults.font.size = 13
        defaults.color = '#212b32'
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
        AccordionBox,
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
            /** all events of the uploaded file */
            fileEvents: null as PatientEvent[] | null,
            /** days covered by the uploaded file */
            fileDays: [] as Date[],
            /** index of the day of the file that is looked at */
            selectedDay: 0,
            /** changes whenever other data is loaded (resets the timeline) */
            dataKey: 0,
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
            /** whether the introduction is shown (on the first visit) */
            showIntro: !introSeen(),
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
                    { name: "Original day", metrics: this.baselineMetrics },
                    { name: `With change (${this.whatIfName})`, metrics: this.metrics },
                ]
            }
            const name = this.patientEvents ? "Original day" : "Simulated day"
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
            return "Results updated. " + tir(first) + (second ? " " + tir(second) : "")
        },
        glucoseDescription(): string {
            return describeGlucose(this.describedDays)
        },
        insulinDescription(): string {
            return describeInsulin(this.describedDays)
        },
        /** simulated period in plain words */
        friendlySpan(): string {
            const span = this.simulationSpan
            return span ? `${friendlyDateTime(span.t0)} to ${friendlyDateTime(span.tmax)}` : ""
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
                const csvText = await file.text()
                // allows the same file to be selected again later
                input.value = ''

                let parsed: PatientEvent[]
                try {
                    parsed = parsePatientEventsCSV(csvText)
                } catch (err) {
                    this.csvError = `We could not read ${file.name}. `
                        + `${(err as Error).message}. Check the file and try again.`
                    return
                }
                this.csvError = ''
                this.csvFileName = file.name
                this.activeScenarioId = null
                this.fileEvents = parsed
                this.fileDays = getDays(parsed)
                // files with several days are looked at one day at a time
                this.loadDay(0)
            },
        /** loads one day of the uploaded file as the logged day */
        loadDay(index: number): void {
            const all = toRaw(this.fileEvents) ?? []
            const days = toRaw(this.fileDays)
            const events = days.length > 1 ? eventsForDay(all, days[index]) : all
            this.selectedDay = index
            this.setLoggedDay(events)
        },
        /** sets the logged day, removing results of earlier data */
        setLoggedDay(events: PatientEvent[]): void {
            this.originalPatientEvents = structuredClone(toRaw(events))
            this.patientEvents = structuredClone(toRaw(events))
            this.dataKey++
            this.chartGlucose().clearRuns()
            this.chartInsulinCarbs().clearRuns()
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

            // both charts show the same period and the same exercise, so
            // that doses and meals line up with their effect on glucose
            const span = this.simulationSpan ?? null
            const exercise = getExercisesFromEvents(events ?? []).map((e) => ({
                start: e.start,
                end: new Date(e.start.valueOf() + e.duration * 60e3),
            }))
            for (const chart of [chartGlucose, chartInsulinCarbs]) {
                chart.setExercise(exercise)
                chart.setTimeRange(span)
            }

            this.metrics = computeGlucoseMetrics(results)
            this.baselineMetrics = (isWhatIf && loggedDay)
                ? computeGlucoseMetrics(loggedDay) : null
        },
        /** loads a teaching scenario as the logged day */
        loadScenario(scenario: TeachingScenario): void {
            this.csvFileName = ''
            this.csvError = ''
            this.fileEvents = null
            this.fileDays = []
            this.activeScenarioId = scenario.id
            this.setLoggedDay(scenario.events)
        },
        /** name of a day for the day picker, e.g. "Monday 5 October" */
        dayName(day: Date): string {
            return day.toLocaleDateString("en-GB",
                { weekday: "long", day: "numeric", month: "long" })
        },
        /** applies a what-if of the loaded teaching scenario */
        applyWhatIf(whatIf: WhatIf): void {
            this.patientEvents = structuredClone(toRaw(whatIf.events))
            this.run()
            // on phones, the results are below the scenario: show them
            if (window.matchMedia(PHONE_LAYOUT).matches) {
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                document.getElementById("results-heading")?.scrollIntoView(
                    { behavior: reduce ? "auto" : "smooth", block: "start" })
            }
        },
        /** hides the introduction, also on later visits */
        hideIntro(): void {
            this.showIntro = false
            try {
                localStorage.setItem(INTRO_SEEN_KEY, "1")
            } catch {
                // without storage, it is shown again next time
            }
            this.$nextTick(() => (<HTMLElement>this.$refs.introLink)?.focus())
        },
        /** shows the introduction again */
        openIntro(): void {
            this.showIntro = true
            this.$nextTick(() => (<HTMLElement>this.$refs.intro)?.focus())
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
        /** draws the hover line at the same time in both charts */
        hoverTimeChanged(time: number | null): void {
            this.chartGlucose().setHoverTime(time)
            this.chartInsulinCarbs().setHoverTime(time)
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
                // the logged day and the what-if are simulated alike, so that
                // they stay comparable: if either has exercise, both use the
                // exercise model
                const withExercise = hasExercise(toRaw(this.patientEvents) ?? [])
                    || hasExercise(toRaw(this.originalPatientEvents) ?? [])
                const { results, usedExerciseModel } = simulateEvents(events,
                    this.getPatient(), this.getSensor(),
                    { ...this.getOptions(), ...this.simulationSpan }, sim,
                    withExercise)
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
                this.patient = newPatient
                const profile = newPatient?.getPatientProfile?.()
                if (typeof profile !== "undefined") {
                    this.patientProfile = profile
                }
                // results simulated with the old settings no longer apply:
                // remove earlier what-ifs and simulate the day again
                if (this.patientEvents) {
                    this.chartGlucose().clearRuns()
                    this.chartInsulinCarbs().clearRuns()
                    this.run()
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
        <section class="box lt1-controls" aria-labelledby="day-heading">
            <h2 id="day-heading">Choose a day</h2>

            <div v-if="showIntro" class="ss-intro" ref="intro" tabindex="-1"
                role="region" aria-labelledby="intro-heading">
                <h3 id="intro-heading">How to use SweetSpot</h3>
                <ol>
                    <li>
                        <strong>Pick a scenario</strong> below, or upload a
                        day of your own.
                    </li>
                    <li>
                        <strong>Try a change</strong>, such as taking insulin
                        earlier. On a phone, the changes are at the bottom of
                        the screen.
                    </li>
                    <li>
                        <strong>Read the summary</strong> under the charts to
                        see how much of the day glucose was in range.
                    </li>
                </ol>
                <button type="button" @click="hideIntro">Hide this introduction</button>
            </div>
            <p v-else class="ss-intro-link">
                <a href="#" ref="introLink" @click.prevent="openIntro">How to use SweetSpot</a>
            </p>
            <div style="display: none;">    
                <ControllerSelection @controllerChanged="controllerChanged" 
                    :patientProfile="patientProfile" ref="controller" />
                <SensorSelection @valueChanged="sensorChanged" />
                <ActuatorSelection @valueChanged="actuatorChanged" />
                <MealTable v-if='options.t0' :t0="options.t0" @mealsChanged="mealsChanged" ref="meals" />
                <ExerciseTable v-if='options.t0' :t0="options.t0" @exercisesChanged="exercisesChanged" />
                <SimulationOptionsConfig @valueChanged="optionsChanged" ref="options" />
            </div>

            <TeachingScenarioPanel :scenarios="scenarios"
                :activeId="activeScenarioId"
                @load="loadScenario" @whatIf="applyWhatIf" />

            <div class="lt1-csv-input">
                <h3>Or use your own day</h3>
                <p class="ss-hint">
                    Upload a CSV file with the insulin, food and glucose
                    readings of a day. It stays on this device.
                </p>
                <label for="csvUpload">Upload a CSV file</label>
                <input type="file" id="csvUpload" accept=".csv" @change="onCsvFileSelected" />
                <p v-if="csvFileName && !csvError" class="ss-hint">Using {{ csvFileName }}</p>
                <p v-if="csvError" class="csv-error" role="alert">{{ csvError }}</p>
                <div v-if="fileDays.length > 1" class="day-picker">
                    <label for="daySelect">Day to look at</label>
                    <p class="ss-hint" id="dayHint">
                        The file covers {{ fileDays.length }} days. Choose one
                        day to look at.
                    </p>
                    <select id="daySelect" aria-describedby="dayHint"
                        :value="selectedDay"
                        @change="loadDay(Number(($event.target as HTMLSelectElement).value))">
                        <option v-for="(day, index) in fileDays" :key="index" :value="index">
                            {{ dayName(day) }}
                        </option>
                    </select>
                </div>
            </div>

            <p v-if="simulationSpan" class="ss-hint">
                Showing {{ friendlySpan }}.
            </p>
            <p v-if="usedExerciseModel" class="ss-hint">
                Exercise is shown using a virtual person who responds to
                exercise (the Deichmann 2021 model).
            </p>

            <button v-if="isEdited" @click="resetToLoggedDay">
                Undo all changes
            </button>

            <!-- secondary for scenarios (which offer changes to try),
                 open for uploaded days, where it is the way to make changes -->
            <AccordionBox v-if="patientEvents" :key="dataKey"
                title="Edit the day yourself" :initial="!activeScenarioId">
                <PatientTimeline
                    :events="patientEvents"
                    @timelineChanged="timelineChanged"
                />
            </AccordionBox>

            <VirtualPatientSelection @patientChanged="patientChanged" />
        </section>
        <section class="box lt1-results" aria-labelledby="results-heading">
            <h2 id="results-heading">What happens to glucose</h2>
            <p v-if="!metrics" class="ss-hint">
                Choose a practice scenario or upload a day to see the results here.
            </p>
            <p class="visually-hidden" role="status">{{ statusMessage }}</p>
            <ChartGlucose ref="chartGlucose" :description="glucoseDescription"
                @runVisibilityChanged="syncInsulinRuns"
                @hoverTime="hoverTimeChanged" />
            <ChartInsulinCarbs ref="chartInsulinCarbs" @selectLog="controllerDataHover"
                :description="insulinDescription"
                @runVisibilityChanged="insulinRunVisibilityChanged"
                @hoverTime="hoverTimeChanged" />
            <ScenarioComparison :metrics="metrics" :baseline="baselineMetrics"
                :isLoggedDay="patientEvents !== null" />
        </section>
    </div>
</template>


<style lang="css">
/* introduction on the first visit */
.ss-intro {
    border-left: 8px solid var(--ss-primary);
    background-color: var(--ss-primary-light);
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
}

.ss-intro ol {
    padding-left: 1.5rem;
    margin: 0 0 0.5rem 0;
}

.ss-intro li {
    margin-bottom: 0.5rem;
}

.ss-intro-link {
    font-size: 0.95rem;
}

/* error message: red bar on the left, as in the NHS design system */
.csv-error {
    color: var(--ss-error);
    font-weight: bold;
    border-left: 4px solid var(--ss-error);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
}

.lt1-csv-input {
    margin: 1.5rem 0 1rem 0;
    padding-top: 1rem;
    border-top: 1px solid var(--ss-border);
}

.day-picker {
    margin-top: 0.75rem;
}

.day-picker select {
    display: block;
    width: 100%;
    box-sizing: border-box;
}

.lt1-csv-input input[type=file] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    border: none;
    padding-left: 0;
}
</style>


<i18n locale="en">
{
	"settings": 	"Settings",
	"run": 			"Show results",
	"results":		"What happens to glucose",
	"whatif":		"your change",
	"simulated":	"simulated glucose",
    "shortcut":     "or press Ctrl+Enter",
}
</i18n>
