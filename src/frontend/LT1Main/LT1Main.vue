<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, toRaw } from 'vue'
import { defaults } from 'chart.js'
import VirtualPatientSelection from './VirtualPatientSelection.vue'
import ChartGlucose from './ChartGlucose.vue'
import ChartInsulinCarbs from './ChartInsulinCarbs.vue'
import { SimulationResult } from '../../types/SimulationResult.js'
import Patient from '../../types/Patient.js'
import { EventSimulation, hasExercise } from '../../common/SimulateEvents.js'
import { ModuleSpec, requestKey, SimulationRequest } from '../../common/SimulationRequest.js'
import { SimulationClient } from '../util/SimulationClient.js'
import { friendlyDateTime } from '../util/FriendlyDate.js'
import { getPatientDataTimeSpan } from '../../common/PatientDataTimeSpan.js'
import PatientEvent from '../../types/PatientEvent.js'
import { getEventWarnings, getExercisesFromEvents } from '../../common/PatientEvents.js'
import { decodeScenarioLink, scenarioFromFile } from '../../common/ScenarioFiles.js'
import DayUpload from './DayUpload.vue'
import { OWN_DATA_NOTICE } from '../util/SafetyTexts.js'
import EducatorPanel from './EducatorPanel.vue'
import { buildInfo } from '../util/BuildInfo.js'
import PatientTimeline from './PatientTimeline.vue'
import ScenarioComparison from './ScenarioComparison.vue'
import TeachingScenarioPanel from './TeachingScenarioPanel.vue'
import AccordionBox from './AccordionBox.vue'
import {
    getTeachingScenarios,
    TeachingScenario,
    WhatIf
} from '../../common/TeachingScenarios.js'
import { computeGlucoseMetrics, GlucoseMetrics, modelLimitNote } from '../../common/GlucoseMetrics.js'
import {
    DescribedDay,
    describeGlucose,
    describeInsulin
} from '../../common/ChartDescriptions.js'

/**
 * the CGM of the virtual person (Breton 2008, default settings); it does not
 * change the glucose of the person, which the results are based on
 */
export const SENSOR: ModuleSpec = { model: "Breton2008", parameters: {} }

/** simulation settings: steps of at most 5 minutes, and a fixed random seed */
export const SIMULATION_OPTIONS = { dt: 5, seed: 1 }

/** resolved once the virtual person has been loaded (see patientChanged) */
let patientLoaded: () => void
const patientReady = new Promise<void>((resolve) => { patientLoaded = resolve })

/** simulates days of logged events in a background thread */
const simulations = new SimulationClient()

/**
 * The simulation of the original day, kept while only the changes differ:
 * it is simulated again only if the day, its period, the virtual person or
 * the sensor change (all part of the key).
 */
let originalDayCache: { key: string, simulation: Promise<EventSimulation> } | null = null

/** number of the latest run; results of earlier runs are not shown */
let latestRun = 0

/** results are calculating for longer than this (ms) before saying so */
const CALCULATING_DELAY = 300

/** media query of the layout with the results below the settings */
const PHONE_LAYOUT = "(max-width: 879px)"

/** key in local storage remembering that the introduction was hidden */
const INTRO_SEEN_KEY = "sweetspot-intro-seen"

/** key in local storage remembering that the tools for educators are shown */
const EDUCATOR_TOOLS_KEY = "sweetspot-educator-tools"

/** whether the tools for educators are shown: ?educator in the link, or remembered */
function educatorToolsWanted(): boolean {
    if (new URLSearchParams(location.search).has("educator")) {
        return true
    }
    try {
        return localStorage.getItem(EDUCATOR_TOOLS_KEY) === "1"
    } catch {
        return false
    }
}

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
        VirtualPatientSelection,
        ChartGlucose,
        ChartInsulinCarbs,
        PatientTimeline,
        ScenarioComparison,
        TeachingScenarioPanel,
        AccordionBox,
        EducatorPanel,
        DayUpload,
    },

    data() {
        return {
            originalPatientEvents: null as PatientEvent[] | null,  // never mutated — baseline for comparison
            patientEvents: null as PatientEvent[] | null,          // working copy the timeline will edit
            /** whether the day shown is the learner's own data */
            ownData: false,
            ownDataNotice: OWN_DATA_NOTICE,
            /** changes whenever other data is loaded (resets the timeline) */
            dataKey: 0,
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
            /**
             * whether the learner's own data can be opened; builds for
             * clearly educational use open scenario files only
             */
            personalData: buildInfo.personalData,
            /** amounts that are much larger than in most days */
            eventWarnings: [] as string[],
            /** says when results are outside what is possible */
            modelNote: '' as string,
            /** problem opening a shared scenario, if any */
            scenarioError: '',
            /** whether results take a while to calculate */
            calculating: false,
            /** problem simulating the day, if any */
            simulationError: '',
            /**
             * whether the tools for educators are shown (making scenarios,
             * settings of the virtual person); hidden for learners
             */
            educatorTools: educatorToolsWanted(),
            /** whether a new version of SweetSpot is ready to use */
            updateReady: false,
            /** whether the introduction is shown (on the first visit) */
            showIntro: !introSeen(),
        }
    },

    async mounted() {
        window.addEventListener('beforeprint', this.openDetailsForPrint)
        window.addEventListener('afterprint', this.closeDetailsAfterPrint)
        window.addEventListener('hashchange', this.openScenarioLink)
        window.addEventListener('sweetspot-update-ready', this.showUpdateReady)
        // open a scenario shared as a link, once the virtual person is ready
        await patientReady
        this.openScenarioLink()
    },

    unmounted() {
        window.removeEventListener('beforeprint', this.openDetailsForPrint)
        window.removeEventListener('afterprint', this.closeDetailsAfterPrint)
        window.removeEventListener('hashchange', this.openScenarioLink)
        window.removeEventListener('sweetspot-update-ready', this.showUpdateReady)
    },

    computed: {
        /** the scenario shown, if any */
        activeScenario(): TeachingScenario | null {
            return this.scenarios.find((s) => s.id === this.activeScenarioId) ?? null
        },
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
        /** shows a day of the learner's own data (from DayUpload) */
        openOwnDay(events: PatientEvent[]): void {
            this.activeScenarioId = null
            this.ownData = true
            this.setLoggedDay(events)
        },
        /** shows a scenario file from an educator (from DayUpload) */
        openSharedScenario(scenario: TeachingScenario): void {
            this.useScenario({ ...scenario, shared: true })
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
        /**
         * Simulates the day (and the change, if the timeline was edited) and
         * shows the results. Days of logged events are simulated in a
         * background thread; if another run starts meanwhile, only the
         * latest one is shown.
         */
        async run(): Promise<void> {
            const runId = ++latestRun
            await patientReady
            const events = toRaw(this.patientEvents)
            const original = toRaw(this.originalPatientEvents)
            if (!events || !original || runId !== latestRun) {
                return
            }

            // the original day and the change are simulated alike, so that
            // they stay comparable: if either has exercise, both use the
            // exercise model
            const isWhatIf = this.isEdited
            const withExercise = hasExercise(events) || hasExercise(original)
            const originalRequest = this.simulationRequest(original, withExercise)
            const whatIfRequest = isWhatIf
                ? this.simulationRequest(events, withExercise) : null

            const timer = setTimeout(() => { this.calculating = true }, CALCULATING_DELAY)
            let loggedDay: EventSimulation, whatIf: EventSimulation | null
            try {
                [loggedDay, whatIf] = await Promise.all([
                    this.simulateOriginalDay(originalRequest),
                    whatIfRequest ? simulations.simulate(whatIfRequest) : null,
                ])
            }
            catch (error) {
                console.error(error)
                if (runId === latestRun) {
                    this.simulationError = "Sorry, the results could not be "
                        + "worked out. Try again, or reload the page."
                }
                return
            }
            finally {
                clearTimeout(timer)
                if (runId === latestRun) {
                    this.calculating = false
                }
            }
            if (runId !== latestRun) {
                return
            }
            this.simulationError = ''
            this.usedExerciseModel = loggedDay.usedExerciseModel
                || (whatIf?.usedExerciseModel ?? false)
            this.showResults(whatIf?.results ?? loggedDay.results,
                loggedDay.results, isWhatIf, events)
        },
        /**
         * Shows simulation results in the charts and the summary.
         * @param results - results of the latest simulation
         * @param loggedDay - results of the original day
         * @param isWhatIf - whether the results are a change of the original day
         * @param events - events of the latest simulation
         */
        showResults(results: SimulationResult[], loggedDay: SimulationResult[],
            isWhatIf: boolean, events: PatientEvent[]): void {
            this.resetCharts()
            const original = toRaw(this.originalPatientEvents)
            const chartGlucose = this.chartGlucose()
            const chartInsulinCarbs = this.chartInsulinCarbs()

            // the charts' main simulation is the original day; changes are
            // added to it
            this.propagateSimulationResults(loggedDay)
            chartGlucose.setLoggedDay(loggedDay)
            if (isWhatIf) {
                const key = JSON.stringify(events)
                chartGlucose.addRun(results, key, this.$t("whatif"),
                    this.scenarioWhatIfLabel(key))
                chartInsulinCarbs.addRun(results, events ?? [], key,
                    chartGlucose.getRunLabel(key))
                this.whatIfName = chartGlucose.getRunLabel(key)
            }
            else {
                chartGlucose.highlightRun(null)
            }
            const mainEvents = original ?? events
            chartGlucose.setMeasuredGlucose(
                mainEvents.filter((event) => event.type === "glucose"))
            chartInsulinCarbs.setLongActingInjections(
                mainEvents.filter((event) => event.type === "longacting"))
            this.syncInsulinRuns()

            // both charts show the same period and the same exercise, so
            // that doses and meals line up with their effect on glucose
            const span = this.simulationSpan ?? null
            const exercise = getExercisesFromEvents(events).map((e) => ({
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
            // amounts that look like typing mistakes, and results that are
            // not possible (both kinds of days are looked at)
            this.eventWarnings = [...new Set(getEventWarnings(
                [...(original ?? []), ...events]))]
            this.modelNote = [this.metrics, this.baselineMetrics]
                .map((m) => m && modelLimitNote(m)).find((note) => note) ?? ""
        },
        /**
         * Describes the simulation of logged events over the period shown,
         * with the current virtual person and sensor.
         */
        simulationRequest(events: PatientEvent[], withExercise: boolean): SimulationRequest {
            const patient = <InstanceType<typeof VirtualPatientSelection>>this.$refs.patientSelection
            return {
                events,
                patient: patient.getModuleSpec(),
                sensor: SENSOR,
                options: { ...SIMULATION_OPTIONS, ...this.simulationSpan },
                withExercise,
            }
        },
        /** simulates the original day, unless it is unchanged since the last run */
        simulateOriginalDay(request: SimulationRequest): Promise<EventSimulation> {
            const key = requestKey(request)
            if (originalDayCache?.key !== key) {
                const simulation = simulations.simulate(request)
                originalDayCache = { key, simulation }
                // a failed simulation is tried again next time
                simulation.catch(() => {
                    if (originalDayCache?.simulation === simulation) {
                        originalDayCache = null
                    }
                })
            }
            return originalDayCache!.simulation
        },
        /** loads a teaching scenario as the logged day */
        loadScenario(scenario: TeachingScenario): void {
            const upload = <InstanceType<typeof DayUpload>>this.$refs.upload
            upload?.clear()
            this.ownData = false
            this.activeScenarioId = scenario.id
            this.setLoggedDay(scenario.events)
        },
        /** applies a what-if of the loaded teaching scenario */
        applyWhatIf(whatIf: WhatIf): void {
            this.patientEvents = structuredClone(toRaw(whatIf.events))
            this.run()
            this.scrollToResultsOnPhones()
        },
        /** adds a scenario written by an educator (or replaces it) and shows it */
        useScenario(scenario: TeachingScenario): void {
            const index = this.scenarios.findIndex((s) => s.id === scenario.id)
            if (index >= 0) {
                this.scenarios.splice(index, 1, scenario)
            }
            else {
                this.scenarios.push(scenario)
            }
            this.scenarioError = ''
            this.loadScenario(scenario)
        },
        /** opens the scenario in the link of the page, if there is one */
        openScenarioLink(): void {
            try {
                const data = decodeScenarioLink(location.hash)
                if (data !== undefined) {
                    this.useScenario({
                        ...scenarioFromFile(data, new Date(), 'shared-link'), shared: true })
                }
            } catch (err) {
                this.scenarioError = `We could not open the scenario in this link. `
                    + `${(err as Error).message}.`
            }
        },
        /** printed summaries show the things to remember, which are folded away */
        openDetailsForPrint(): void {
            document.querySelectorAll('.scenario-card details:not([open])').forEach((d) => {
                d.setAttribute('open', '')
                d.setAttribute('data-print-opened', '')
            })
        },
        closeDetailsAfterPrint(): void {
            document.querySelectorAll('details[data-print-opened]').forEach((d) => {
                d.removeAttribute('open')
                d.removeAttribute('data-print-opened')
            })
        },
        /** shows or hides the tools for educators, also on later visits */
        toggleEducatorTools(): void {
            this.educatorTools = !this.educatorTools
            try {
                localStorage.setItem(EDUCATOR_TOOLS_KEY, this.educatorTools ? "1" : "0")
            } catch {
                // without storage, they are hidden again next time
            }
        },
        /** a share of the time, e.g. 85% */
        percent(value: number): string {
            return `${Math.round(value)}%`
        },
        /** a new version has been stored (see entries/LT1Main.ts) */
        showUpdateReady(): void {
            this.updateReady = true
        },
        /** switches to the new version: the page is loaded again */
        useUpdate(): void {
            window.dispatchEvent(new CustomEvent('sweetspot-use-update'))
        },
        /** prints a summary of the day for group sessions */
        printSummary(): void {
            window.print()
        },
        /** shows the original day of the scenario (e.g. from a quiz answer) */
        showOriginalDay(): void {
            this.resetToLoggedDay()
            this.scrollToResultsOnPhones()
        },
        /** on phones, the results are below the scenario: show them */
        scrollToResultsOnPhones(): void {
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
        /** the virtual person was loaded, or its settings changed */
        patientChanged(newPatient: Patient): void {
            if (typeof newPatient?.getParameterValues === "function") {
                patientLoaded()
                // results simulated with the old settings no longer apply:
                // remove earlier what-ifs and simulate the day again
                if (this.patientEvents) {
                    this.chartGlucose().clearRuns()
                    this.chartInsulinCarbs().clearRuns()
                    this.run()
                }
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
    <div class="ss-page-heading">
        <h1>Practise insulin and food decisions</h1>
        <p class="ss-lede">
            Try different choices with a made-up person, and see what happens
            to glucose.
        </p>
    </div>
    <div class="lt1-container">
        <section class="box lt1-controls" aria-labelledby="day-heading">
            <h2 id="day-heading">Choose a day</h2>

            <!-- the live region is always there, so that the message is read out -->
            <div aria-live="polite">
                <div v-if="updateReady" class="ss-inset update-ready">
                    <p>A new version of SweetSpot is ready.</p>
                    <button type="button" @click="useUpdate">Use the new version</button>
                </div>
            </div>

            <div v-if="showIntro" class="ss-intro" ref="intro" tabindex="-1"
                role="region" aria-labelledby="intro-heading">
                <h3 id="intro-heading">How to use SweetSpot</h3>
                <ol>
                    <li>
                        <strong>Pick a scenario</strong> below<template v-if="personalData">,
                        or upload a day of your own</template>.
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
            <p v-if="scenarioError" class="csv-error" role="alert">{{ scenarioError }}</p>
            <TeachingScenarioPanel :scenarios="scenarios"
                :activeId="activeScenarioId"
                @load="loadScenario" @whatIf="applyWhatIf"
                @showOriginal="showOriginalDay" />

            <DayUpload ref="upload" @day="openOwnDay" @scenario="openSharedScenario" />

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

            <!-- kept while other days are loaded, so that a scenario being
                 written is not lost when it is tried out -->
            <AccordionBox v-if="patientEvents && originalPatientEvents" v-show="educatorTools"
                title="For educators: make and share a scenario" class="no-print">
                <EducatorPanel
                    :scenario="activeScenario"
                    :originalEvents="originalPatientEvents"
                    :currentEvents="isEdited ? patientEvents : null"
                    @use="useScenario"
                />
            </AccordionBox>

            <!-- always there, as it provides the virtual person; shown with
                 the tools for educators -->
            <div v-show="educatorTools" class="no-print">
                <VirtualPatientSelection @patientChanged="patientChanged" ref="patientSelection" />
            </div>

            <p class="educator-toggle no-print">
                <button type="button" class="ss-link-button" @click="toggleEducatorTools"
                    :aria-expanded="educatorTools">
                    {{ educatorTools ? "Hide tools for educators" : "Show tools for educators" }}
                </button>
            </p>
        </section>
        <section class="box lt1-results" aria-labelledby="results-heading">
            <h2 id="results-heading">What happens to glucose</h2>
            <p v-if="!metrics" class="ss-hint">
                Choose a practice scenario or upload a day to see the results here.
            </p>
            <div v-if="ownData" class="ss-inset own-data-notice">{{ ownDataNotice }}</div>
            <div v-if="eventWarnings.length" class="ss-inset results-warning">
                <h3>Check these amounts</h3>
                <ul>
                    <li v-for="warning in eventWarnings" :key="warning">{{ warning }}</li>
                </ul>
            </div>
            <p v-if="modelNote" class="csv-error" role="alert">{{ modelNote }}</p>
            <!-- the main result first, before the charts -->
            <div v-if="metrics && !modelNote" class="results-headline">
                <template v-if="baselineMetrics">
                    <p>
                        Time in range: <strong>{{ percent(baselineMetrics.timeInRange) }}</strong>
                        on the original day, <strong>{{ percent(metrics.timeInRange) }}</strong>
                        with the change.
                    </p>
                    <p>
                        Time low: <strong>{{ percent(baselineMetrics.timeBelowRange) }}</strong>
                        on the original day, <strong>{{ percent(metrics.timeBelowRange) }}</strong>
                        with the change.
                    </p>
                </template>
                <p v-else>
                    Time in range: <strong>{{ percent(metrics.timeInRange) }}</strong>.
                    Time low: <strong>{{ percent(metrics.timeBelowRange) }}</strong>.
                </p>
            </div>
            <p class="visually-hidden" role="status">{{ statusMessage }}</p>
            <p v-if="calculating" class="ss-hint calculating">Working out the results…</p>
            <p v-if="simulationError" class="csv-error" role="alert">{{ simulationError }}</p>
            <ChartGlucose ref="chartGlucose" :description="glucoseDescription"
                @runVisibilityChanged="syncInsulinRuns"
                @hoverTime="hoverTimeChanged" />
            <ChartInsulinCarbs ref="chartInsulinCarbs"
                :description="insulinDescription"
                @runVisibilityChanged="insulinRunVisibilityChanged"
                @hoverTime="hoverTimeChanged" />
            <ScenarioComparison :metrics="metrics" :baseline="baselineMetrics"
                :isLoggedDay="patientEvents !== null" />
            <button v-if="metrics" type="button" class="no-print" @click="printSummary">
                Print a summary
            </button>
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

/* the main result, above the charts */
.results-headline {
    font-size: 1.15rem;
    border-left: 8px solid var(--ss-primary);
    padding: 0.25rem 0 0.25rem 1rem;
    margin: 0 0 0.5rem 0;
}

.results-headline p {
    margin: 0.25rem 0;
}

.results-headline strong {
    font-size: 1.3rem;
}

/* error message: red bar on the left, as in the NHS design system */
.csv-error {
    color: var(--ss-error);
    font-weight: bold;
    border-left: 4px solid var(--ss-error);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
}

</style>


<i18n locale="en">
{
	"whatif":		"Your change",
}
</i18n>
