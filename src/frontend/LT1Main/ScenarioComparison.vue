<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType } from 'vue'
import { GlucoseMetrics } from '../../common/GlucoseMetrics.js'
import AccordionBox from './AccordionBox.vue'

type Row = {
    key: keyof GlucoseMetrics
    unit: string
    decimals: number
    /** whether a higher or lower value means better glucose control */
    better?: "higher" | "lower"
}

const rows: Row[] = [
    { key: "timeInRange", unit: "%", decimals: 0, better: "higher" },
    { key: "timeBelowRange", unit: "%", decimals: 0, better: "lower" },
    { key: "timeVeryLow", unit: "%", decimals: 0, better: "lower" },
    { key: "timeAboveRange", unit: "%", decimals: 0, better: "lower" },
    { key: "meanGlucose", unit: "mmol/L", decimals: 1 },
    { key: "minGlucose", unit: "mmol/L", decimals: 1 },
    { key: "maxGlucose", unit: "mmol/L", decimals: 1 },
    { key: "bolusInsulin", unit: "U", decimals: 1 },
    { key: "basalInsulin", unit: "U", decimals: 1 },
    { key: "carbs", unit: "g", decimals: 0 },
]

export default defineComponent({
    components: { AccordionBox },

    props: {
        /** metrics of the simulated (what-if) day */
        metrics: {
            type: Object as PropType<GlucoseMetrics | null>,
            default: null,
        },
        /** metrics of the logged day, if it differs from the what-if day */
        baseline: {
            type: Object as PropType<GlucoseMetrics | null>,
            default: null,
        },
        /** whether metrics without baseline belong to a logged day */
        isLoggedDay: {
            type: Boolean,
            default: false,
        },
    },

    data() {
        return { rows }
    },

    methods: {
        format(value: number, row: Row): string {
            return isFinite(value) ? value.toFixed(row.decimals) + " " + row.unit : "-"
        },
        difference(row: Row): string {
            const diff = this.metrics![row.key] - this.baseline![row.key]
            const rounded = Number(diff.toFixed(row.decimals))
            if (!isFinite(rounded)) {
                return "-"
            }
            const sign = rounded > 0 ? "+" : ""
            return sign + rounded.toFixed(row.decimals) + " " + row.unit
        },
        /** CSS class telling whether the change improves glucose control */
        differenceClass(row: Row): string {
            const diff = Number((this.metrics![row.key]
                - this.baseline![row.key]).toFixed(row.decimals))
            if (!row.better || !isFinite(diff) || diff === 0) {
                return ""
            }
            const improved = (row.better === "higher") === (diff > 0)
            return improved ? "improved" : "worsened"
        },
    },
})
</script>


<template>
    <AccordionBox :title="$t('title')" :initial="true" v-if="metrics">
        <table class="scenario-comparison">
            <thead>
                <tr>
                    <th></th>
                    <th v-if="baseline">{{ $t("logged") }}</th>
                    <th>{{ baseline ? $t("whatif")
                        : isLoggedDay ? $t("logged") : $t("simulated") }}</th>
                    <th v-if="baseline">{{ $t("change") }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in rows" :key="row.key">
                    <td>{{ $t(row.key) }}</td>
                    <td v-if="baseline">{{ format(baseline[row.key], row) }}</td>
                    <td>{{ format(metrics[row.key], row) }}</td>
                    <td v-if="baseline" :class="differenceClass(row)">
                        {{ difference(row) }}
                    </td>
                </tr>
            </tbody>
        </table>
        <p v-if="isLoggedDay && !baseline" class="scenario-hint">{{ $t("hint") }}</p>
    </AccordionBox>
</template>


<style scoped>
.scenario-comparison {
    width: 100%;
    border-collapse: collapse;
}

.scenario-comparison th,
.scenario-comparison td {
    padding: 4px 8px;
    text-align: right;
}

.scenario-comparison td:first-child {
    text-align: left;
}

/* small phones: tighter cells so that four columns fit */
@media (max-width: 420px) {
    .scenario-comparison {
        font-size: 0.8rem;
    }

    .scenario-comparison th,
    .scenario-comparison td {
        padding: 3px 3px;
    }
}

.scenario-comparison tbody tr:nth-child(odd) {
    background: rgba(127, 127, 127, 0.1);
}

.scenario-comparison .improved {
    color: rgb(80, 160, 60);
    font-weight: bold;
}

.scenario-comparison .worsened {
    color: rgb(210, 40, 40);
    font-weight: bold;
}

.scenario-hint {
    font-size: 0.9em;
    opacity: 0.8;
}
</style>


<i18n locale="en">
{
    "title": "Day summary",
    "logged": "Logged day",
    "whatif": "What-if",
    "simulated": "Simulated",
    "change": "Change",
    "hint": "Edit the patient timeline and apply the changes to compare a what-if day with the logged day.",
    "timeInRange": "Time in range (3.9-10.0 mmol/L)",
    "timeBelowRange": "Time below 3.9 mmol/L",
    "timeVeryLow": "Time below 3.0 mmol/L",
    "timeAboveRange": "Time above 10.0 mmol/L",
    "meanGlucose": "Mean glucose",
    "minGlucose": "Lowest glucose",
    "maxGlucose": "Highest glucose",
    "bolusInsulin": "Bolus insulin",
    "basalInsulin": "Basal / long-acting insulin",
    "carbs": "Carbs",
}
</i18n>
<i18n locale="de">
{
    "title": "Tageszusammenfassung",
    "logged": "Protokollierter Tag",
    "whatif": "Was-wäre-wenn",
    "simulated": "Simuliert",
    "change": "Änderung",
    "hint": "Bearbeiten Sie die Zeitleiste und übernehmen Sie die Änderungen, um einen Was-wäre-wenn-Tag mit dem protokollierten Tag zu vergleichen.",
    "timeInRange": "Zeit im Zielbereich (3,9-10,0 mmol/L)",
    "timeBelowRange": "Zeit unter 3,9 mmol/L",
    "timeVeryLow": "Zeit unter 3,0 mmol/L",
    "timeAboveRange": "Zeit über 10,0 mmol/L",
    "meanGlucose": "Mittlere Glukose",
    "minGlucose": "Niedrigste Glukose",
    "maxGlucose": "Höchste Glukose",
    "bolusInsulin": "Bolusinsulin",
    "basalInsulin": "Basal-/Langzeitinsulin",
    "carbs": "Kohlenhydrate",
}
</i18n>
