<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import uniqueId from '../util/UniqueId.js'
import { defineComponent, PropType } from 'vue'
import DailyProfile from '../../common/DailyProfile.js'
import { displayUnit } from '../../common/GlucoseUnits.js'
import { ParameterDescription } from '../../types/ParametricModule.js'
import countDecimals from '../util/CountDecimals.js'
import plainText from '../util/PlainText.js'
import InfoboxTooltip from './InfoboxTooltip.vue'

export default defineComponent({
    emits: ["valueChanged"],
    props: {
        config: {
            type: Object as PropType<ParameterDescription>,
            required: true,
        },
        defaultValue: {
            type: Number,
            required: true,
        },
        id: String,
        description: String,
        tooltip: String,
    },
    data() {
        return {
            /** unique on the page, as parameter names repeat across modules */
            inputId: uniqueId('param-' + this.id),
            value: NaN
        };
    },
    computed: {
        stepDistance(): number {
            return Math.pow(10, countDecimals(this.defaultValue || 1))
        },
        /** unit and conversion factor for display (e.g., mg/dl -> mmol/L) */
        display(): { unit: string, factor: number } {
            return displayUnit(this.config?.unit || "")
        },
        min(): number {
            return (this.config?.min ?? -Infinity) * this.display.factor
        },
        max(): number {
            return (this.config?.max ?? +Infinity) * this.display.factor
        },
        step(): number {
            if (this.display.factor !== 1) {
                return 0.1
            }
            return this.config?.step || this?.stepDistance || 0
        },
        unit(): string {
            return this.display.unit
        },
        /** name of the input for assistive technology */
        accessibleName(): string {
            return [plainText(this.description), this.unit]
                .filter((part) => part).join(", ")
        },
        /** value as shown to the user, in display units */
        displayValue: {
            get(): number {
                const { factor } = this.display
                return factor === 1 ? this.value
                    : Number((this.value * factor).toPrecision(3))
            },
            set(value: number) {
                this.value = value / this.display.factor
            },
        },
    },
    watch: {
        defaultValue: {
            handler: function (val: number) {
                if (val !== this.value && typeof val !== "undefined") {
                    // console.log("change number to " + val)
                    this.value = val
                    this.valueChanged()
                }
            },
            immediate: true,
        },
    },
    methods: {
        valueChanged() {
            this.$emit("valueChanged", this.value)
        },
        toProfile() {
            this.$emit("valueChanged", new DailyProfile([[0, this.value]]))
        }
    },
    components: { InfoboxTooltip }
})
</script>


<template>
    <li class="parameterlist-item">
        <div class="item-description">
            <InfoboxTooltip :description="description" :tooltip="tooltip" />
        </div>
        <div class="item-input">
            <input type="number" v-model.number=displayValue
                :id="inputId" 
                :aria-label="accessibleName"
                :min="isFinite(min) ? min : undefined"
                :max="isFinite(max) ? max : undefined"
                :step="step"
                @change="valueChanged()">
            <svg v-tooltip="{ content: $t('toProfile') }" 
                @click="toProfile"
                class="profile-symbol" 
                version="1.1"
                xmlns="http://www.w3.org/2000/svg" 
                xmlns:xlink="http://www.w3.org/1999/xlink" 
                viewBox="0 0 46 46"
                xml:space="preserve" >
                <circle cx="23" cy="23" r="22"  />
                <polyline points="5,30 15,20 24,35 32,10 40,20"  
                    stroke="white" 
                    stroke-width="3" 
                    fill="none" />
            </svg>
        </div>
        <div class="item-unit">{{ unit }}</div>
        <slot></slot>
    </li>
</template>

<style>
.profile-symbol {
    fill: #0055A3;
    height:1em;
}
</style>


<i18n locale="en">
{
    "toProfile"			: "Click to convert to daily profile (Warning - experimental!)",
}
</i18n>
    
