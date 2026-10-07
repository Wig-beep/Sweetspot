<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType } from 'vue'
import { DescribedDay } from '../../common/ChartDescriptions.js'
import { GlucoseMetrics } from '../../common/GlucoseMetrics.js'

type Part = { key: "high" | "inRange" | "low", label: string, percent: number }

/**
 * Stacked time-in-range bars (high, in range, low) of one or more days,
 * side by side, as in CGM reports. The percentages are written next to each
 * bar, so the bars themselves are hidden from screen readers.
 */
export default defineComponent({
    props: {
        days: {
            type: Array as PropType<DescribedDay[]>,
            required: true,
        },
    },

    methods: {
        /** parts of a bar, from top to bottom */
        parts(metrics: GlucoseMetrics): Part[] {
            const value = (percent: number) => isFinite(percent) ? percent : 0
            return [
                { key: "high", label: "High (above 10)", percent: value(metrics.timeAboveRange) },
                { key: "inRange", label: "In range (3.9 to 10)", percent: value(metrics.timeInRange) },
                { key: "low", label: "Low (below 3.9)", percent: value(metrics.timeBelowRange) },
            ]
        },
    },
})
</script>


<template>
    <div class="tir-days">
        <figure v-for="day in days" :key="day.name" class="tir-day">
            <figcaption>{{ day.name }}</figcaption>
            <div class="tir-body">
                <div class="tir-bar" aria-hidden="true">
                    <span v-for="part in parts(day.metrics)" :key="part.key"
                        :class="'tir-' + part.key"
                        :style="{ flexGrow: part.percent }"></span>
                </div>
                <ul class="tir-values">
                    <li v-for="part in parts(day.metrics)" :key="part.key">
                        <span class="tir-swatch" :class="'tir-' + part.key" aria-hidden="true"></span>
                        <span>{{ part.label }}</span>
                        <strong>{{ Math.round(part.percent) }}%</strong>
                    </li>
                </ul>
            </div>
        </figure>
    </div>
</template>


<style scoped>
.tir-days {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin: 0.5rem 0 1rem 0;
}

.tir-day {
    flex: 1 1 10rem;
    margin: 0;
    min-width: 0;
}

.tir-day figcaption {
    font-weight: bold;
    margin-bottom: 0.25rem;
}

.tir-body {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
}

/* the colours of the glucose chart */
.tir-bar {
    flex: none;
    width: 2rem;
    height: 8.5rem;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ss-border-strong);
    background: var(--ss-card);
}

.tir-bar span {
    flex-basis: 0;
    min-height: 0;
}

/* a thin line between parts, so that they can be told apart without colour */
.tir-bar span + span {
    border-top: 1px solid var(--ss-card);
}

.tir-high {
    background-color: rgb(90, 150, 250);
}

.tir-inRange {
    background-color: rgb(120, 176, 89);
}

.tir-low {
    background-color: rgb(194, 1, 18);
}

.tir-values {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 0.95rem;
}

.tir-values li {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.4rem;
    align-items: center;
    line-height: 1.3;
}

.tir-values strong {
    grid-column: 2;
    font-size: 1.1rem;
}

.tir-swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1px solid var(--ss-border-strong);
}
</style>
