<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType, toRaw } from 'vue'
import {
    encodeScenarioLink,
    SCENARIO_LIMITS,
    scenarioFromFile,
    scenarioToFile
} from '../../common/ScenarioFiles.js'
import { QuizAnswer, TeachingScenario } from '../../common/TeachingScenarios.js'
import PatientEvent from '../../types/PatientEvent.js'
import uniqueId from '../util/UniqueId.js'

/** a change to try, as it is being written */
type DraftWhatIf = { key: number, label: string, description: string, events: PatientEvent[] }
/** an answer to the question, as it is being written; for the original day or a change */
type DraftAnswer = { text: string, feedback: string }

/** key of the original day among the answers */
const ORIGINAL = -1

let nextKey = 0

/**
 * Lets educators write a practice scenario from the day shown (and changes
 * made to it), try it out, and share it as a file or a link.
 */
export default defineComponent({
    props: {
        /** the scenario shown, if any (its texts are the starting point) */
        scenario: {
            type: Object as PropType<TeachingScenario | null>,
            default: null,
        },
        /** events of the day shown */
        originalEvents: {
            type: Array as PropType<PatientEvent[]>,
            required: true,
        },
        /** events of the change shown, if the day was changed */
        currentEvents: {
            type: Array as PropType<PatientEvent[] | null>,
            default: null,
        },
    },

    emits: ["use"],

    data() {
        return {
            id: uniqueId("educator"),
            limits: SCENARIO_LIMITS,
            ORIGINAL,
            /** whether a scenario is being written */
            started: false,
            /** id of the scenario written, the same each time it is tried out */
            scenarioId: "",
            title: "",
            goal: "",
            story: "",
            keyPoints: "",
            modelNote: "",
            events: [] as PatientEvent[],
            whatIfs: [] as DraftWhatIf[],
            question: "",
            /** answers by key: ORIGINAL or the key of a change */
            answers: {} as Record<number, DraftAnswer>,
            /** key of the right answer */
            rightAnswer: null as number | null,
            /** problem found when checking the scenario */
            error: "",
            /** what happened after the last action, e.g. "Link copied" */
            message: "",
            /** the link, shown if it cannot be copied */
            link: "",
        }
    },

    computed: {
        /** whether a change is shown that is not yet a change to try */
        hasNewChange(): boolean {
            if (!this.currentEvents) return false
            const json = JSON.stringify(this.currentEvents)
            return json !== JSON.stringify(this.events)
                && !this.whatIfs.some((w) => JSON.stringify(w.events) === json)
        },
        /** the original day and the changes, as possible answers */
        answerOptions(): { key: number, name: string }[] {
            return [
                { key: ORIGINAL, name: "The original day" },
                ...this.whatIfs.map((w, i) => ({
                    key: w.key, name: w.label || `Change ${i + 1}`,
                })),
            ]
        },
    },

    methods: {
        /** starts a scenario from the day shown */
        start() {
            const s = this.scenario
            this.title = s?.title ?? ""
            this.goal = s?.goal ?? ""
            this.story = s?.story ?? ""
            this.keyPoints = (s?.keyPoints ?? []).join("\n")
            this.modelNote = s?.modelNote ?? ""
            this.events = structuredClone(toRaw(this.originalEvents))
            this.whatIfs = (s?.whatIfs ?? []).map((w) => ({
                key: nextKey++, label: w.label, description: w.description,
                events: structuredClone(toRaw(w.events)),
            }))
            this.question = s?.quiz?.question ?? ""
            this.answers = {}
            this.rightAnswer = null
            for (const option of this.answerOptions) {
                const answer = s?.quiz?.answers.find((a) => (a.whatIf ?? null)
                    === (option.key === ORIGINAL ? null : this.labelOf(option.key)))
                this.answers[option.key] = { text: answer?.text ?? "", feedback: answer?.feedback ?? "" }
                if (answer?.correct) this.rightAnswer = option.key
            }
            this.scenarioId = s?.shared ? s.id : "custom-" + nextKey++
            this.error = ""
            this.message = ""
            this.started = true
            this.$nextTick(() => document.getElementById(this.id + "-title")?.focus())
        },
        labelOf(key: number): string {
            return this.whatIfs.find((w) => w.key === key)?.label ?? ""
        },
        /** adds the change shown as a change to try */
        addChange() {
            const key = nextKey++
            this.whatIfs.push({
                key, label: "", description: "",
                events: structuredClone(toRaw(this.currentEvents!)),
            })
            this.answers[key] = { text: "", feedback: "" }
            this.$nextTick(() => document.getElementById(`${this.id}-label-${key}`)?.focus())
        },
        removeChange(key: number) {
            this.whatIfs = this.whatIfs.filter((w) => w.key !== key)
            delete this.answers[key]
            if (this.rightAnswer === key) this.rightAnswer = null
        },
        /**
         * Returns the scenario written, checked as if it was opened from a
         * file, or shows the problem and returns undefined.
         */
        build(): TeachingScenario | undefined {
            const answers: QuizAnswer[] = this.answerOptions
                .filter((option) => this.answers[option.key]?.text.trim())
                .map((option) => ({
                    text: this.answers[option.key].text,
                    feedback: this.answers[option.key].feedback,
                    correct: option.key === this.rightAnswer,
                    ...(option.key !== ORIGINAL ? { whatIf: this.labelOf(option.key) } : {}),
                }))
            const draft: TeachingScenario = {
                id: "draft",
                title: this.title,
                goal: this.goal,
                story: this.story,
                events: this.events,
                whatIfs: this.whatIfs.map((w) => ({
                    label: w.label, description: w.description, events: w.events,
                })),
                keyPoints: this.keyPoints.split("\n").map((p) => p.trim()).filter((p) => p),
                ...(this.modelNote.trim() ? { modelNote: this.modelNote } : {}),
                ...(this.question.trim() || answers.length
                    ? { quiz: { question: this.question, answers } } : {}),
            }
            try {
                const file = JSON.parse(JSON.stringify(scenarioToFile(draft)))
                const scenario = scenarioFromFile(file, new Date(), this.scenarioId)
                this.error = ""
                return { ...scenario, shared: true }
            }
            catch (error) {
                this.error = (<Error>error).message
                this.message = ""
                this.$nextTick(() => (<HTMLElement>this.$refs.error)?.focus())
                return undefined
            }
        },
        /** shows the scenario as learners will see it */
        tryOut() {
            const scenario = this.build()
            if (scenario) {
                this.$emit("use", scenario)
                this.message = "The scenario is shown above, as learners will see it."
            }
        },
        /** saves the scenario as a file */
        save() {
            const scenario = this.build()
            if (!scenario) return
            const json = JSON.stringify(scenarioToFile(scenario), null, 1)
            const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
            const a = document.createElement("a")
            a.href = url
            a.download = "sweetspot-scenario-" + (scenario.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scenario") + ".json"
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            this.message = `Saved as ${a.download}. Learners can open it with "Upload a file".`
        },
        /** copies a link that opens the scenario */
        async copyLink() {
            const scenario = this.build()
            if (!scenario) return
            const page = location.href.split("#")[0]
            this.link = page + encodeScenarioLink(scenarioToFile(scenario))
            try {
                await navigator.clipboard.writeText(this.link)
                this.message = "Link copied. Anyone who opens it sees this scenario."
            }
            catch {
                this.message = "Copy the link below to share the scenario."
            }
        },
    },
})
</script>


<template>
    <div class="educator-panel">
        <p class="ss-hint">
            Make a practice scenario from the day shown, with changes for
            learners to try, and share it as a file or a link.
        </p>
        <div class="ss-inset">
            Do not write names or other personal details. Scenarios hold the
            texts you write and the entries of the day as times of day, with
            no dates.
        </div>
        <button v-if="!started" type="button" @click="start">Start from this day</button>

        <form v-else novalidate @submit.prevent="tryOut">
            <p v-if="error" class="educator-error" role="alert" tabindex="-1" ref="error">
                <span class="visually-hidden">Error:</span> {{ error }}
            </p>

            <label :for="id + '-title'">Title</label>
            <input :id="id + '-title'" v-model="title" :maxlength="limits.label * 2" />

            <label :for="id + '-goal'">What learners will learn</label>
            <textarea :id="id + '-goal'" v-model="goal" rows="2" :maxlength="limits.text"></textarea>

            <label :for="id + '-story'">The story of the day</label>
            <textarea :id="id + '-story'" v-model="story" rows="3" :maxlength="limits.text"></textarea>

            <fieldset class="educator-changes">
                <legend>Changes to try</legend>
                <p class="ss-hint">
                    Change the day under "Edit the day yourself" and select
                    "Show this change", then add it here.
                </p>
                <div v-for="(w, i) in whatIfs" :key="w.key" class="educator-change">
                    <label :for="`${id}-label-${w.key}`">Name of change {{ i + 1 }} (short)</label>
                    <input :id="`${id}-label-${w.key}`" v-model="w.label" :maxlength="limits.label" />
                    <label :for="`${id}-desc-${w.key}`">What is different</label>
                    <textarea :id="`${id}-desc-${w.key}`" v-model="w.description" rows="2"
                        :maxlength="limits.text"></textarea>
                    <button type="button" @click="removeChange(w.key)">
                        Remove change {{ i + 1 }}
                    </button>
                </div>
                <button type="button" :disabled="!hasNewChange" @click="addChange">
                    Add the change shown
                </button>
            </fieldset>

            <label :for="id + '-points'">Things to remember (one on each line)</label>
            <textarea :id="id + '-points'" v-model="keyPoints" rows="3"></textarea>

            <label :for="id + '-note'">Note on the simulation (optional)</label>
            <textarea :id="id + '-note'" v-model="modelNote" rows="2" :maxlength="limits.text"></textarea>

            <fieldset class="educator-quiz">
                <legend>Question for learners (optional)</legend>
                <label :for="id + '-question'">Question</label>
                <input :id="id + '-question'" v-model="question" :maxlength="limits.text" />
                <p class="ss-hint">
                    Write an answer for the original day or any change. Leave
                    the answer empty to leave it out.
                </p>
                <div v-for="option in answerOptions" :key="option.key" class="educator-answer">
                    <h5>{{ option.name }}</h5>
                    <label :for="`${id}-answer-${option.key}`">Answer</label>
                    <input :id="`${id}-answer-${option.key}`" v-model="answers[option.key].text"
                        :maxlength="limits.text" />
                    <label :for="`${id}-feedback-${option.key}`">Feedback</label>
                    <input :id="`${id}-feedback-${option.key}`" v-model="answers[option.key].feedback"
                        :maxlength="limits.text" />
                    <div class="ss-radio">
                        <input type="radio" :id="`${id}-right-${option.key}`" :name="id + '-right'"
                            :value="option.key" v-model="rightAnswer" />
                        <label :for="`${id}-right-${option.key}`">This is the right answer</label>
                    </div>
                </div>
            </fieldset>

            <div class="educator-actions">
                <button type="submit" class="ss-primary">Try it out</button>
                <button type="button" @click="save">Save as a file</button>
                <button type="button" @click="copyLink">Copy a link</button>
            </div>
            <p v-if="message" class="educator-message" role="status">{{ message }}</p>
            <div v-if="link">
                <label :for="id + '-link'">Link to the scenario</label>
                <input :id="id + '-link'" :value="link" readonly
                    @focus="($event.target as HTMLInputElement).select()" />
            </div>
        </form>
    </div>
</template>


<style scoped>
.educator-panel label {
    display: block;
    margin-top: 0.75rem;
}

.educator-panel input:not([type=radio]),
.educator-panel textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 1rem;
    padding: 0.3rem 0.4rem;
    border: 2px solid var(--ss-border-strong);
    border-radius: var(--ss-radius);
}

.educator-panel fieldset {
    border: none;
    padding: 0;
    margin: 1rem 0 0 0;
    min-width: 0;
}

.educator-panel legend {
    font-weight: bold;
    font-size: 1.05rem;
    padding: 0;
}

.educator-change,
.educator-answer {
    border-left: 4px solid var(--ss-border);
    padding-left: 0.75rem;
    margin: 0.75rem 0;
}

.educator-answer h5 {
    font-size: 1rem;
    margin: 0;
}

.educator-panel .ss-radio {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.educator-panel .ss-radio label {
    margin: 0;
    font-weight: normal;
}

.educator-panel .ss-radio input {
    width: 1.5rem;
    height: 1.5rem;
    min-height: 0;
    margin: 0;
    accent-color: var(--ss-primary);
}

.educator-actions {
    margin-top: 1rem;
}

.educator-error {
    color: var(--ss-error);
    font-weight: bold;
    border-left: 4px solid var(--ss-error);
    padding-left: 0.75rem;
}

.educator-message {
    font-weight: bold;
}
</style>
