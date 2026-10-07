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

    data() {
        return {
            /** whether the changes to try are open (phones only, see below) */
            sheetOpen: false,
        }
    },

    computed: {
        active(): TeachingScenario | undefined {
            return this.scenarios.find((s) => s.id === this.activeId)
        },
    },

    watch: {
        /** makes room at the bottom of the page for the sheet on phones */
        active: {
            immediate: true,
            handler(active: TeachingScenario | undefined) {
                document.body.classList.toggle("has-whatif-sheet", !!active)
            },
        },
    },

    unmounted() {
        document.body.classList.remove("has-whatif-sheet")
    },

    methods: {
        choose(scenario: TeachingScenario) {
            this.$emit("load", scenario)
        },
        tryWhatIf(whatIf: WhatIf) {
            this.$emit("whatIf", whatIf)
            // on phones, the sheet closes so that the charts can be seen;
            // focus stays on the sheet rather than on the hidden button
            if (this.sheetOpen) {
                this.sheetOpen = false
                this.$nextTick(() => (<HTMLElement>this.$refs.sheetToggle)?.focus())
            }
        },
        closeSheet() {
            if (this.sheetOpen) {
                this.sheetOpen = false;
                (<HTMLElement>this.$refs.sheetToggle)?.focus()
            }
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

            <!-- on phones, a sheet at the bottom of the screen, so that the
                 changes can be tried while looking at the charts -->
            <div class="whatif-sheet" :class="{ open: sheetOpen }"
                @keydown.esc="closeSheet">
                <h4>
                    <span class="whatif-title">Try a change</span>
                    <button type="button" class="whatif-toggle" ref="sheetToggle"
                        :aria-expanded="sheetOpen" aria-controls="whatifList"
                        @click="sheetOpen = !sheetOpen">
                        Try a change
                        <span class="whatif-count">({{ active.whatIfs.length }})</span>
                    </button>
                </h4>
                <ul class="scenario-whatifs" id="whatifList">
                    <li v-for="whatIf in active.whatIfs" :key="whatIf.label">
                        <button @click="tryWhatIf(whatIf)">{{ whatIf.label }}</button>
                        <span>{{ whatIf.description }}</span>
                    </li>
                </ul>
            </div>

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

/* the toggle is only needed for the sheet on phones */
.whatif-toggle {
    display: none;
}

@media screen and (max-width: 879px) {
    .whatif-sheet {
        position: fixed;
        z-index: 10;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--ss-card);
        border-top: 4px solid var(--ss-primary);
        box-shadow: 0 -2px 8px rgba(33, 43, 50, 0.25);
        padding: 0 1rem;
    }

    .whatif-sheet h4 {
        margin: 0;
    }

    .whatif-title {
        display: none;
    }

    /* the whole bar is the button */
    .lt1-container .whatif-toggle {
        display: flex;
        width: 100%;
        margin: 0.5rem 0;
        align-items: center;
        gap: 0.4rem;
        background-color: var(--ss-primary);
        color: #ffffff;
    }

    .whatif-toggle::after {
        content: "";
        margin-left: auto;
        border: 0.4rem solid transparent;
        border-bottom-color: currentColor;
        border-top-width: 0;
    }

    .open .whatif-toggle::after {
        border-bottom-width: 0;
        border-top: 0.4rem solid currentColor;
    }

    .whatif-count {
        font-weight: normal;
    }

    .whatif-sheet .scenario-whatifs {
        display: none;
        max-height: 50vh;
        overflow-y: auto;
        margin-bottom: 0.5rem;
    }

    .whatif-sheet.open .scenario-whatifs {
        display: block;
    }
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
