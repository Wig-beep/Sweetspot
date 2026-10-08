<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType } from 'vue'
import { Quiz, QuizAnswer } from '../../common/TeachingScenarios.js'
import uniqueId from '../util/UniqueId.js'

/**
 * A question to check what was learned in a scenario, with feedback on the
 * answer chosen and a way to see that answer on the charts.
 */
export default defineComponent({
    props: {
        quiz: {
            type: Object as PropType<Quiz>,
            required: true,
        },
    },

    emits: ["show"],

    data() {
        return {
            id: uniqueId("quiz"),
            /** index of the chosen answer */
            chosen: null as number | null,
            /** the answer that was checked */
            checked: null as QuizAnswer | null,
            /** shown when checking without choosing an answer */
            error: "",
        }
    },

    watch: {
        /** another scenario: start again */
        quiz() {
            this.chosen = null
            this.checked = null
            this.error = ""
        },
    },

    methods: {
        check() {
            if (this.chosen === null) {
                this.error = "Choose an answer"
                this.checked = null
                this.$nextTick(() => document.getElementById(this.id + "-0")?.focus())
                return
            }
            this.error = ""
            this.checked = this.quiz.answers[this.chosen]
            this.$nextTick(() => (<HTMLElement>this.$refs.feedback)?.focus())
        },
        /** shows the checked answer on the charts */
        show() {
            this.$emit("show", this.checked!.whatIf)
        },
    },
})
</script>


<template>
    <form class="scenario-quiz" novalidate @submit.prevent="check">
        <h4>Check your understanding</h4>
        <fieldset :aria-describedby="error ? id + '-error' : undefined"
            :class="{ 'has-error': error }">
            <legend>{{ quiz.question }}</legend>
            <p v-if="error" class="quiz-error" :id="id + '-error'">
                <span class="visually-hidden">Error:</span> {{ error }}
            </p>
            <div class="ss-radio" v-for="(answer, index) in quiz.answers" :key="answer.text">
                <input type="radio" :name="id" :id="id + '-' + index" :value="index"
                    v-model="chosen" @change="checked = null" />
                <label :for="id + '-' + index">{{ answer.text }}</label>
            </div>
        </fieldset>
        <button type="submit">Check my answer</button>

        <div v-if="checked" class="quiz-feedback" ref="feedback" tabindex="-1"
            :class="checked.correct ? 'is-right' : 'is-wrong'">
            <p>{{ checked.feedback }}</p>
            <button type="button" @click="show">
                {{ checked.whatIf ? "Show this change on the charts" : "Show the original day" }}
            </button>
        </div>
    </form>
</template>


<style scoped>
.scenario-quiz {
    margin: 1rem 0;
    padding-top: 0.75rem;
    border-top: 1px solid var(--ss-border);
}

.scenario-quiz fieldset {
    border: none;
    padding: 0;
    margin: 0 0 0.5rem 0;
    min-width: 0;
}

.scenario-quiz legend {
    font-weight: bold;
    padding: 0;
    margin-bottom: 0.5rem;
}

/* error: red bar on the left, as in the NHS design system */
.scenario-quiz fieldset.has-error {
    border-left: 4px solid var(--ss-error);
    padding-left: 0.75rem;
}

.quiz-error {
    color: var(--ss-error);
    font-weight: bold;
}

/* feedback: green or red bar, and the words "Right" or "Not quite" */
.quiz-feedback {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-left: 8px solid;
    background-color: var(--ss-primary-light);
}

.quiz-feedback.is-right {
    border-color: #007f3b;
}

.quiz-feedback.is-wrong {
    border-color: var(--ss-error);
}

/* focused to be read out: an outline rather than the yellow fill of controls */
.quiz-feedback:focus-visible {
    outline: 3px solid var(--ss-focus);
    box-shadow: none;
    background-color: var(--ss-primary-light);
}

.quiz-feedback p {
    margin-bottom: 0.25rem;
}
</style>
