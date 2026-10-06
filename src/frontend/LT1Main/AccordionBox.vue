<script lang="ts">
/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        title: String,
        initial: Boolean,
    },

    data() {
        return {
            boxactive: this.initial,
            // unique id linking the header button to the content
            contentId: "accordion-" + Math.random().toString(36).slice(2),
        }
    },
})
</script>


<template>
    <div :class="{ accordionbox: true, boxactive }">
        <h3>
            <button type="button" :aria-expanded="boxactive"
                :aria-controls="contentId"
                @click="boxactive = !boxactive">{{ title }}</button>
        </h3>
        <div class="accordioncontent" :id="contentId" :inert="!boxactive">
            <slot></slot>
        </div>
    </div>
</template>


<style scoped>
.accordionbox {
    border: solid;
    border-width: 1px;
    border-color: #aaaaaa;
    padding: .5rem;
    margin-top: 0.5rem;
    display: grid;
    grid-template-rows: 1rem 0fr;
    transition: grid-template-rows 0.5s;
}

.boxactive {
    grid-template-rows: 2rem 1fr !important;
}

div.accordioncontent {
    overflow: hidden;
}

h3 {
    font-size: 1rem;
    line-height: 1rem;
    font-weight: bold;
    position: relative;
    margin-bottom: 1rem;
    color: #586067;
    background-color: #f4f4ff;
    width: 100%;
    padding: .5rem;
    margin: -.5rem;
    height: 1rem;
    border-bottom: 1px solid #aaaaaa;
    box-sizing: content-box;
}

/* the header button looks like the header itself */
h3 button {
    all: inherit;
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    cursor: pointer;
}

h3 button:focus-visible {
    outline: 3px solid #0055A3;
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .accordionbox,
    .accordionbox h3::after {
        transition: none;
    }
}

/* arrow to open or close box content */
.accordionbox h3::after {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    pointer-events: none;
    transition: all 0.5s;
    content: "\25BC";
}

.boxactive h3::after {
    transform: scaleY(-1);
}
</style>
