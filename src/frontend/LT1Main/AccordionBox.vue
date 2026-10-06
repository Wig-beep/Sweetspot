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
    border: 1px solid var(--ss-border, #d8dde0);
    border-radius: var(--ss-radius, 4px);
    margin-top: 1rem;
    display: grid;
    grid-template-rows: auto 0fr;
    transition: grid-template-rows 0.4s;
}

.boxactive {
    grid-template-rows: auto 1fr;
}

div.accordioncontent {
    overflow: hidden;
    padding: 0 0.75rem;
}

.boxactive div.accordioncontent {
    padding: 0.5rem 0.75rem 0.75rem 0.75rem;
}

h3 {
    position: relative;
    margin: 0;
    font-size: 1.05rem;
    font-weight: bold;
    color: var(--ss-text, #212b32);
    background-color: var(--ss-primary-light, #e3f1f2);
    border-radius: var(--ss-radius, 4px) var(--ss-radius, 4px) 0 0;
}

/* the header button fills the header: a large, easy target */
h3 button {
    all: inherit;
    display: block;
    width: 100%;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.6rem 2.5rem 0.6rem 0.75rem;
    text-align: left;
    cursor: pointer;
    border-radius: inherit;
}

h3 button:focus-visible {
    background-color: var(--ss-focus, #ffeb3b);
    box-shadow: inset 0 -4px 0 var(--ss-text, #212b32);
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
    top: 0.6rem;
    right: 0.75rem;
    pointer-events: none;
    transition: transform 0.4s;
    content: "\25BC";
    color: var(--ss-primary-dark, #004e57);
}

.boxactive h3::after {
    transform: scaleY(-1);
}
</style>
