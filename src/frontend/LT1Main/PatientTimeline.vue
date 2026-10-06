<template>
    <div class="patient-timeline">
        <h3>Patient Timeline</h3>

        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Value</th>
                    <th>Details</th>
                    <th></th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="(row, index) in rows" :key="row.id">
                    <td>
                        <input
                            type="datetime-local"
                            v-model="row.timeString"
                        />
                    </td>

                    <td>
                        <select v-model="row.type">
                            <option v-for="type in eventTypes" :key="type" :value="type">
                                {{ typeLabels[type] }}
                            </option>
                        </select>
                    </td>

                    <td>
                        <input
                            type="number"
                            min="0"
                            :step="row.type === 'carbs' ? 1 : 0.1"
                            v-model.number="row.value"
                        />
                    </td>

                    <td>
                        <input
                            v-if="row.type === 'carbs'"
                            type="number"
                            min="1"
                            step="1"
                            placeholder="duration (min)"
                            title="Duration of the meal in min"
                            v-model.number="row.duration"
                        />
                        <select
                            v-else-if="row.type === 'longacting'"
                            v-model="row.insulin"
                            title="Long-acting insulin"
                        >
                            <option v-for="insulin in insulins" :key="insulin" :value="insulin">
                                {{ insulinLabels[insulin] }}
                            </option>
                        </select>
                    </td>

                    <td>
                        <button @click="removeRow(index)" title="Remove event">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>

        <button @click="addRow">
            Add event
        </button>
        <button @click="applyChanges">
            Apply changes
        </button>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { DEFAULT_LONG_ACTING_INSULIN } from "../../common/LongActingInsulin.js"
import { sortByTime } from "../../common/PatientEvents.js"
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
    basal: "Basal rate (U/h)",
    bolus: "Bolus (U)",
    carbs: "Carbs (g)",
    longacting: "Long-acting (U)",
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
            eventTypes: PATIENT_EVENT_TYPES,
            typeLabels,
            insulins: LONG_ACTING_INSULINS,
            insulinLabels,
        }
    },

    watch: {
        events: {
            immediate: true,
            deep: true,

            handler() {
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

        addRow() {
            const last = this.rows.at(-1)
            this.rows.push({
                id: nextRowId++,
                timeString: last?.timeString
                    ?? this.toDateTimeLocal(new Date()),
                type: "bolus",
                value: 0,
                insulin: DEFAULT_LONG_ACTING_INSULIN,
            })
        },

        removeRow(index: number) {
            this.rows.splice(index, 1)
        },

        applyChanges() {
            const events: PatientEvent[] = []

            for (const row of this.rows) {
                const time = new Date(row.timeString)
                if (isNaN(time.valueOf())) {
                    continue
                }
                const event: PatientEvent = {
                    time,
                    type: row.type,
                    value: Number(row.value) || 0,
                }
                if (row.type === "carbs" && Number(row.duration) > 0) {
                    event.duration = Number(row.duration)
                }
                if (row.type === "longacting") {
                    event.insulin = row.insulin
                }
                events.push(event)
            }

            this.$emit("timelineChanged", sortByTime(events))
        }
    }
})
</script>

<style scoped>
.patient-timeline {
    margin-top: 20px;
    overflow-x: auto;
}

.patient-timeline table {
    width: 100%;
    border-collapse: collapse;
}

.patient-timeline th,
.patient-timeline td {
    padding: 6px;
    border: 1px solid #ccc;
}

.patient-timeline input,
.patient-timeline select {
    width: 100%;
    box-sizing: border-box;
}

.patient-timeline button {
    margin-top: 10px;
    margin-right: 6px;
    padding: 6px 12px;
}

.patient-timeline td button {
    margin: 0;
    padding: 2px 6px;
}
</style>
