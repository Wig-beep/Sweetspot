<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType } from 'vue'
import { TeachingScenario, WhatIf } from '../../common/TeachingScenarios.js'

export default defineComponent({
    props: {
        scenarios: {
            type: Array as PropType<TeachingScenario[]>,
            required: true,
        },
        /** id of the loaded scenario, or null */
        activeId: {
            type: String as PropType<string | null>,
            default: null,
        },
    },

    emits: ["load", "whatIf"],

    computed: {
        active(): TeachingScenario | undefined {
            return this.scenarios.find((s) => s.id === this.activeId)
        },
    },

    methods: {
        choose(scenario: TeachingScenario) {
            this.$emit("load", scenario)
        },
        tryWhatIf(whatIf: WhatIf) {
            this.$emit("whatIf", whatIf)
        },
    },
})
</script>


<template>
    <div class="teaching-scenarios">
        <!-- radios rather than a drop-down: titles wrap instead of being cut
             off, and all choices are visible (NHS design system guidance) -->
        <fieldset class="scenario-choice" aria-describedby="scenarioHint">
            <legend>Practice scenario</legend>
            <p class="ss-hint" id="scenarioHint">
                Each scenario is a day in the life of a made-up person who
                takes insulin injections. Try different choices and see what
                happens.
            </p>
            <div class="ss-radio" v-for="scenario in scenarios" :key="scenario.id">
                <input type="radio" name="scenario"
                    :id="'scenario-' + scenario.id" :value="scenario.id"
                    :checked="scenario.id === activeId"
                    @change="choose(scenario)" />
                <label :for="'scenario-' + scenario.id">{{ scenario.title }}</label>
            </div>
        </fieldset>

        <div v-if="active" class="scenario-card">
            <h3>{{ active.title }}</h3>
            <p><strong>What you will learn:</strong> {{ active.goal }}</p>
            <p>{{ active.story }}</p>

            <h4>Try a change</h4>
            <ul class="scenario-whatifs">
                <li v-for="whatIf in active.whatIfs" :key="whatIf.label">
                    <button @click="tryWhatIf(whatIf)">{{ whatIf.label }}</button>
                    <span>{{ whatIf.description }}</span>
                </li>
            </ul>

            <details>
                <summary>Things to remember</summary>
                <ul>
                    <li v-for="point in active.keyPoints" :key="point">{{ point }}</li>
                </ul>
            </details>

            <p v-if="active.modelNote" class="ss-hint">{{ active.modelNote }}</p>
            <div class="ss-inset">
                This is practice with a made-up person. It cannot tell you what
                dose to take. Always follow the advice of your diabetes team.
            </div>
        </div>
    </div>
</template>


<style scoped>
.scenario-choice {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
}

.scenario-choice legend {
    font-weight: bold;
    padding: 0;
    margin-bottom: 0.25rem;
}

/* large radio buttons with the whole label as a target */
.ss-radio {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.ss-radio input[type=radio] {
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    min-height: 0;
    margin: 0.1rem 0 0 0;
    accent-color: var(--ss-primary);
    cursor: pointer;
}

.ss-radio label {
    font-weight: normal;
    padding: 0.25rem 0;
    cursor: pointer;
}

.scenario-card {
    margin-top: 1rem;
}

.scenario-whatifs {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem 0;
}

.scenario-whatifs li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.75rem;
    margin-bottom: 0.5rem;
}

.scenario-whatifs span {
    flex: 1 1 12rem;
    color: var(--ss-text-secondary);
}

.scenario-card details {
    margin-bottom: 0.75rem;
}

.scenario-card summary {
    cursor: pointer;
    color: var(--ss-primary-dark);
    font-weight: bold;
    text-decoration: underline;
    padding: 0.25rem 0;
}

.scenario-card details ul {
    padding-left: 1.25rem;
    margin: 0.5rem 0;
}

.scenario-card details li {
    margin-bottom: 0.5rem;
}
</style>
