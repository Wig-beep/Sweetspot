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
        selected(event: Event) {
            const id = (event.target as HTMLSelectElement).value
            const scenario = this.scenarios.find((s) => s.id === id)
            if (scenario) {
                this.$emit("load", scenario)
            }
        },
        tryWhatIf(whatIf: WhatIf) {
            this.$emit("whatIf", whatIf)
        },
    },
})
</script>


<template>
    <div class="teaching-scenarios">
        <label for="scenarioSelect">Practice scenario</label>
        <p class="ss-hint" id="scenarioHint">
            Each scenario is a day in the life of a made-up person who takes
            insulin injections. Try different choices and see what happens.
        </p>
        <select id="scenarioSelect" aria-describedby="scenarioHint"
            :value="activeId ?? ''" @change="selected">
            <option value="" disabled>Choose a scenario</option>
            <option v-for="scenario in scenarios" :key="scenario.id" :value="scenario.id">
                {{ scenario.title }}
            </option>
        </select>

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
.teaching-scenarios select {
    width: 100%;
    box-sizing: border-box;
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
