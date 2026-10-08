<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, PropType } from 'vue'
import { LegendLine } from '../util/LegendToggles.js'
import uniqueId from '../util/UniqueId.js'

/**
 * Checkboxes to show or hide the lines of a chart, the same as its legend
 * does, but usable with a keyboard and screen readers. Folded away, so that
 * they do not repeat the legend on screen.
 */
export default defineComponent({
    props: {
        lines: {
            type: Array as PropType<LegendLine[]>,
            required: true,
        },
    },

    emits: ["toggle"],

    data() {
        return { id: uniqueId("lines") }
    },
})
</script>


<template>
    <details v-if="lines.length" class="line-toggles no-print">
        <summary>Show or hide lines</summary>
        <fieldset>
            <legend class="visually-hidden">Lines shown on this chart</legend>
            <div v-for="line in lines" :key="line.index" class="ss-checkbox">
                <input type="checkbox" :id="`${id}-${line.index}`" :checked="line.shown"
                    @change="$emit('toggle', line.index)" />
                <label :for="`${id}-${line.index}`">{{ line.text }}</label>
            </div>
        </fieldset>
    </details>
</template>


<style scoped>
.line-toggles {
    margin: 0.25rem 0 0.5rem 0;
}

.line-toggles summary {
    cursor: pointer;
    color: var(--ss-primary-dark);
    text-decoration: underline;
    padding: 0.25rem 0;
    min-height: 1.5rem;
}

.line-toggles fieldset {
    border: none;
    padding: 0.25rem 0 0 0;
    margin: 0;
    min-width: 0;
}
</style>
