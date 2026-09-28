<template>
    <div class="patient-timeline">
        <h3>Patient Timeline</h3>

        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Meal (g)</th>
                    <th>Bolus (U)</th>
                    <th>Basal (U/hr)</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="(reading, index) in localReadings" :key="index">
                    <td>
                        <input
                            type="datetime-local"
                            v-model="reading.timeString"
                        />
                    </td>

                    <td>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            v-model.number="reading.carbs"
                        />
                    </td>

                    <td>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            v-model.number="reading.bolus"
                        />
                    </td>

                    <td>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            v-model.number="reading.basal"
                        />
                    </td>
                </tr>
            </tbody>
        </table>

        <button @click="applyChanges">
            Apply changes
        </button>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { InsulinReading } from "../../types/InsulinReading.js"
import Meal from "../../types/Meal.js"

type TimelineRow = {
    timeString: string
    basal: number
    bolus: number
    carbs: number
}

export default defineComponent({
    name: "PatientTimeline",

    props: {
        readings: {
            type: Array as () => InsulinReading[],
            required: true
        },

        meals: {
            type: Array as () => Meal[],
            required: true
        }
    },

    emits: ["timelineChanged"],

    data() {
        return {
            localReadings: [] as TimelineRow[]
        }
    },

    watch: {
        readings: {
            immediate: true,
            deep: true,

            handler() {
                this.updateLocalReadings()
            }
        }
    },

    methods: {
        updateLocalReadings() {
            this.localReadings = this.readings.map(reading => {
                const meal = this.meals.find(
                    meal => meal.start.getTime() === reading.time.getTime()
                )

                return {
                    timeString: this.toDateTimeLocal(reading.time),
                    basal: reading.basal,
                    bolus: reading.bolus,
                    carbs: meal?.carbs ?? 0
                }
            })
        },

        toDateTimeLocal(date: Date): string {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, "0")
            const day = String(date.getDate()).padStart(2, "0")
            const hours = String(date.getHours()).padStart(2, "0")
            const minutes = String(date.getMinutes()).padStart(2, "0")

            return `${year}-${month}-${day}T${hours}:${minutes}`
        },

        applyChanges() {
            const readings: InsulinReading[] = []
            const meals: Meal[] = []

            for (const row of this.localReadings) {
                const time = new Date(row.timeString)

                readings.push({
                    time,
                    basal: Number(row.basal) || 0,
                    bolus: Number(row.bolus) || 0
                })

                if (Number(row.carbs) > 0) {
                    meals.push({
                        start: time,
                        carbs: Number(row.carbs),
                        duration: 1
                    })
                }
            }

            this.$emit("timelineChanged", {
                readings,
                meals
            })
        }
    }
})
</script>

<style scoped>
.patient-timeline {
    margin-top: 20px;
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

.patient-timeline input {
    width: 100%;
    box-sizing: border-box;
}

.patient-timeline button {
    margin-top: 10px;
    padding: 6px 12px;
}
</style>