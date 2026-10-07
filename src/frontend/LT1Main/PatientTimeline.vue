<template>
    <div class="patient-timeline">
        <p class="ss-hint">
            Change a time or an amount, or add an entry. Then select
            "Show this change" to compare it with the original day.
        </p>

        <!-- error summary, as in the NHS design system -->
        <div v-if="errorRows.length" class="timeline-error-summary"
            role="alert" tabindex="-1" ref="errorSummary">
            <h4>There is a problem</h4>
            <ul>
                <li v-for="row in errorRows" :key="row.id">
                    <a :href="'#row-' + row.id" @click.prevent="focusRow(row.id)">
                        {{ rowName(row) }}: {{ errors[row.id] }}
                    </a>
                </li>
            </ul>
        </div>

        <p v-if="glucoseCount > 0" class="show-glucose">
            <input type="checkbox" id="showGlucose" v-model="showGlucose" />
            <label for="showGlucose">
                Show glucose readings ({{ glucoseCount }})
            </label>
        </p>

        <ul class="timeline-rows" aria-label="Patient events">
            <li v-for="row in visibleRows" :key="row.id" class="timeline-row"
                :class="{ 'has-error': errors[row.id] }">
                <input
                    class="cell-time"
                    type="datetime-local"
                    :id="'row-' + row.id"
                    :aria-invalid="!!errors[row.id]"
                    :aria-describedby="errors[row.id] ? 'row-error-' + row.id : undefined"
                    :aria-label="fieldLabel(row, 'time')"
                    v-model="row.timeString"
                />

                <select class="cell-type" v-model="row.type" :aria-label="fieldLabel(row, 'event')">
                    <option v-for="type in eventTypes" :key="type" :value="type">
                        {{ typeLabels[type] }}
                    </option>
                </select>

                <input
                    class="cell-value"
                    type="number"
                    min="0"
                    :step="row.type === 'carbs' ? 1 : 0.1"
                    :aria-label="fieldLabel(row, 'amount')"
                    v-model.number="row.value"
                />

                <div class="cell-details">
                    <input
                        v-if="row.type === 'carbs' || row.type === 'exercise'"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="minutes"
                        :title="durationLabel(row.type)"
                        :aria-label="fieldLabel(row, durationLabel(row.type))"
                        v-model.number="row.duration"
                    />
                    <select
                        v-else-if="row.type === 'longacting'"
                        v-model="row.insulin"
                        title="Long-acting insulin"
                        :aria-label="fieldLabel(row, 'which insulin')"
                    >
                        <option v-for="insulin in insulins" :key="insulin" :value="insulin">
                            {{ insulinLabels[insulin] }}
                        </option>
                    </select>
                </div>

                <button class="cell-remove" @click="removeRow(row.id)"
                    title="Remove this entry" :aria-label="'Remove ' + rowName(row)">✕</button>
                <p v-if="errors[row.id]" class="cell-error" :id="'row-error-' + row.id">
                    <span class="visually-hidden">Error:</span> {{ errors[row.id] }}
                </p>
            </li>
        </ul>

        <!-- on phones, the buttons stay at the bottom of the screen while
             the timeline is scrolled -->
        <div class="timeline-actions">
            <button class="ss-primary" @click="applyChanges">
                Show this change
            </button>
            <button @click="addRow">
                Add an entry
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { DEFAULT_LONG_ACTING_INSULIN } from "../../common/LongActingInsulin.js"
import { checkEvent, sortByTime } from "../../common/PatientEvents.js"
import PatientEvent, {
    LONG_ACTING_INSULINS,
    LongActingInsulin,
    PATIENT_EVENT_TYPES,
    PatientEventType
} from "../../types/PatientEvent.js"

type TimelineRow = {
    id: number
    timeString: string
    type: PatientEventType
    value: number
    duration?: number
    insulin: LongActingInsulin
}

const typeLabels: Record<PatientEventType, string> = {
    basal: "Pump rate (units an hour)",
    bolus: "Quick-acting insulin (units)",
    carbs: "Carbs (grams)",
    longacting: "Background insulin (units)",
    exercise: "Exercise (effort %)",
    glucose: "Glucose (mmol/L)",
}

const insulinLabels: Record<LongActingInsulin, string> = {
    glargine: "Glargine (e.g. Lantus)",
    glargine_u300: "Glargine U300 (Toujeo)",
    degludec: "Degludec (Tresiba)",
    detemir: "Detemir (Levemir)",
}

let nextRowId = 0

export default defineComponent({
    name: "PatientTimeline",

    props: {
        events: {
            type: Array as PropType<PatientEvent[]>,
            required: true
        },
    },

    emits: ["timelineChanged"],

    data() {
        return {
            rows: [] as TimelineRow[],
            /**
             * whether glucose readings are listed; they are hidden at first,
             * so that the doses, food and exercise to change stand out
             */
            showGlucose: false,
            /** rows added by the learner, which are always listed */
            addedIds: [] as number[],
            /** problems found when showing a change, by row id */
            errors: {} as Record<number, string>,
            eventTypes: PATIENT_EVENT_TYPES,
            typeLabels,
            insulins: LONG_ACTING_INSULINS,
            insulinLabels,
        }
    },

    computed: {
        /** number of glucose readings in the timeline */
        glucoseCount(): number {
            return this.rows.filter((row) => row.type === "glucose").length
        },
        /**
         * rows shown; glucose readings can be hidden, which keeps long
         * sensor exports manageable (hidden rows are kept unchanged)
         */
        visibleRows(): TimelineRow[] {
            return this.showGlucose ? this.rows
                : this.rows.filter((row) => row.type !== "glucose"
                    || this.errors[row.id] || this.addedIds.includes(row.id))
        },
        /** rows with a problem, in the order shown */
        errorRows(): TimelineRow[] {
            return this.rows.filter((row) => this.errors[row.id])
        },
    },

    watch: {
        events: {
            immediate: true,
            deep: true,

            handler() {
                this.errors = {}
                this.rows = this.events.map(event => ({
                    id: nextRowId++,
                    timeString: this.toDateTimeLocal(event.time),
                    type: event.type,
                    value: event.value,
                    duration: event.duration,
                    insulin: event.insulin ?? DEFAULT_LONG_ACTING_INSULIN,
                }))
            }
        }
    },

    methods: {
        toDateTimeLocal(date: Date): string {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, "0")
            const day = String(date.getDate()).padStart(2, "0")
            const hours = String(date.getHours()).padStart(2, "0")
            const minutes = String(date.getMinutes()).padStart(2, "0")

            return `${year}-${month}-${day}T${hours}:${minutes}`
        },

        durationLabel(type: PatientEventType): string {
            return type === "exercise"
                ? "How long the exercise lasts, in minutes"
                : "How long the meal takes to eat, in minutes"
        },

        addRow() {
            const last = this.rows.at(-1)
            const id = nextRowId++
            this.addedIds.push(id)
            this.rows.push({
                id,
                timeString: last?.timeString
                    ?? this.toDateTimeLocal(new Date()),
                type: "bolus",
                value: 0,
                insulin: DEFAULT_LONG_ACTING_INSULIN,
            })
        },

        removeRow(id: number) {
            this.rows = this.rows.filter((row) => row.id !== id)
        },

        applyChanges() {
            const events: PatientEvent[] = []
            const errors: Record<number, string> = {}
            const isEmpty = (value: unknown) =>
                value === "" || value === null || typeof value === "undefined"

            for (const row of this.rows) {
                const event: PatientEvent = {
                    time: new Date(row.timeString),
                    type: row.type,
                    value: Number(row.value),
                }
                if ((row.type === "carbs" || row.type === "exercise")
                    && !isEmpty(row.duration)) {
                    event.duration = Number(row.duration)
                }
                if (row.type === "longacting") {
                    event.insulin = row.insulin
                }
                const problem = isNaN(event.time.valueOf())
                    ? "enter a date and time"
                    : isEmpty(row.value) ? "enter an amount" : checkEvent(event)
                if (problem) {
                    errors[row.id] = problem.charAt(0).toUpperCase() + problem.slice(1)
                    continue
                }
                events.push(event)
            }

            this.errors = errors
            if (Object.keys(errors).length > 0) {
                // nothing is changed until all entries are valid
                this.$nextTick(() => (<HTMLElement>this.$refs.errorSummary)?.focus())
                return
            }
            this.$emit("timelineChanged", sortByTime(events))
        },

        /** short name of a row for the error summary, e.g. "07:30 bolus" */
        rowName(row: TimelineRow): string {
            const time = row.timeString ? row.timeString.slice(11, 16) : "Entry"
            return `${time} ${typeLabels[row.type].replace(/ \(.*\)$/, "").toLowerCase()}`
        },

        /**
         * label of a field of a row that names the row, e.g. "07:30
         * quick-acting insulin: amount", so that screen reader users can
         * tell the rows apart
         */
        fieldLabel(row: TimelineRow, field: string): string {
            return `${this.rowName(row)}: ${field.charAt(0).toLowerCase() + field.slice(1)}`
        },

        focusRow(id: number) {
            document.getElementById("row-" + id)?.focus()
        },
    }
})
</script>

<style scoped>
.patient-timeline {
    margin-top: 0.5rem;
    /* lay out rows depending on the width available to the timeline */
    container-type: inline-size;
}

.timeline-rows {
    list-style: none;
    padding: 0;
    margin: 0;
}

/*
 * The layout depends on the width available, so that the drop-down
 * labels (e.g. "Quick-acting insulin (units)") are never cut off.
 *
 * Narrow (default, e.g. phones): three lines per entry
 *   time ........................ ✕
 *   event .........................
 *   value    details ..............
 */
.timeline-row {
    display: grid;
    grid-template-columns: minmax(4.5rem, 6rem) minmax(0, 1fr) auto;
    grid-template-areas:
        "time  time    remove"
        "type  type    type"
        "value details details";
    gap: 6px;
    align-items: center;
    padding: 8px 4px;
    border-bottom: 1px solid #ccc;
}

/* narrow: the insulin drop-down gets a line of its own */
.timeline-row:has(.cell-details select) {
    grid-template-areas:
        "time    time    remove"
        "type    type    type"
        "value   .       ."
        "details details details";
}

.timeline-row:nth-child(odd) {
    background: rgba(127, 127, 127, 0.08);
}

/* medium: two lines per entry */
@container (min-width: 620px) {
    .timeline-row {
        grid-template-columns: minmax(16.5rem, 1.2fr) minmax(4.5rem, 6rem)
            minmax(0, 1fr) auto;
        grid-template-areas:
            "time  time  time    remove"
            "type  value details .";
    }

    .timeline-row:has(.cell-details select) {
        grid-template-areas:
            "time  time  time    remove"
            "type  value details .";
    }
}

/* wide: one line per entry */
@container (min-width: 820px) {
    .timeline-row {
        grid-template-columns: minmax(13rem, 1fr) minmax(16.5rem, 1.2fr)
            minmax(4.5rem, 6rem) minmax(13.5rem, 1fr) auto;
        grid-template-areas: "time type value details remove";
    }

    .timeline-row:has(.cell-details select) {
        grid-template-areas: "time type value details remove";
    }
}

/* errors: red bar on the left and a message below the entry */
.timeline-row.has-error {
    border-left: 4px solid var(--ss-error);
}

.cell-error {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--ss-error);
    font-weight: bold;
}

.timeline-error-summary {
    border: 4px solid var(--ss-error);
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
}

.timeline-error-summary h4 {
    margin-top: 0;
}

.timeline-error-summary ul {
    padding-left: 1.25rem;
}

.timeline-error-summary a {
    color: var(--ss-error);
    font-weight: bold;
}

.show-glucose {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.show-glucose input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--ss-primary);
}

.show-glucose label {
    font-weight: normal;
}

.cell-time { grid-area: time; }
.cell-type { grid-area: type; }
.cell-value { grid-area: value; }
.cell-details { grid-area: details; }
.cell-remove { grid-area: remove; }

.timeline-row input,
.timeline-row select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
}

.patient-timeline > button {
    margin-top: 0.75rem;
}

/* compact, but still a comfortable target (at least 36px) */
.timeline-row .cell-remove {
    margin: 0;
    padding: 0;
    min-height: 2.25rem;
    min-width: 2.25rem;
}
</style>
