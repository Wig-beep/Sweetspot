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
        <label for="scenarioSelect">Teaching scenario:</label>
        <select id="scenarioSelect" :value="activeId ?? ''" @change="selected">
            <option value="" disabled>Choose a scenario…</option>
            <option v-for="scenario in scenarios" :key="scenario.id" :value="scenario.id">
                {{ scenario.title }}
            </option>
        </select>

        <div v-if="active" class="scenario-card">
            <p><strong>Goal:</strong> {{ active.goal }}</p>
            <p>{{ active.story }}</p>

            <p class="scenario-try">Try a what-if:</p>
            <ul class="scenario-whatifs">
                <li v-for="whatIf in active.whatIfs" :key="whatIf.label">
                    <button @click="tryWhatIf(whatIf)">{{ whatIf.label }}</button>
                    <span>{{ whatIf.description }}</span>
                </li>
            </ul>

            <details>
                <summary>Key points</summary>
                <ul>
                    <li v-for="point in active.keyPoints" :key="point">{{ point }}</li>
                </ul>
            </details>

            <p v-if="active.modelNote" class="scenario-note">{{ active.modelNote }}</p>
            <p class="scenario-note">
                A simulated virtual person for learning, not advice on your own
                doses. Discuss changes with your diabetes team.
            </p>
        </div>
    </div>
</template>


<style scoped>
.teaching-scenarios {
    margin: 10px 0;
}

.teaching-scenarios select {
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
}

.scenario-card {
    margin-top: 8px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
}

.scenario-card p {
    margin: 0 0 8px 0;
}

.scenario-try {
    font-weight: bold;
}

.scenario-whatifs {
    list-style: none;
    padding: 0;
    margin: 0 0 8px 0;
}

.scenario-whatifs li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin-bottom: 6px;
}

.scenario-whatifs span {
    flex: 1 1 12rem;
    font-size: 0.85rem;
    opacity: 0.85;
}

.scenario-card details {
    margin-bottom: 8px;
}

.scenario-card details ul {
    padding-left: 1.2rem;
    margin: 4px 0;
}

.scenario-note {
    font-size: 0.8rem;
    font-style: italic;
    opacity: 0.8;
}
</style>
