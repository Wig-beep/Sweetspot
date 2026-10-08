<script lang="ts">
/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { defineComponent, toRaw } from 'vue'
import { readPatientData } from '../../common/DeviceExports.js'
import { eventsForDay, getDays } from '../../common/PatientDays.js'
import { sortByTime } from '../../common/PatientEvents.js'
import { isScenarioFile, scenarioFromFile } from '../../common/ScenarioFiles.js'
import PatientEvent from '../../types/PatientEvent.js'
import { buildInfo } from '../util/BuildInfo.js'
import { OWN_DATA_NOTICE } from '../util/SafetyTexts.js'

/**
 * Opens files: a day of the learner's own data (SweetSpot CSV, or exports of
 * LibreView, Dexcom Clarity or Nightscout), or a scenario file from an
 * educator. Files with several days are looked at one day at a time.
 *
 * In builds for clearly educational use (buildInfo.personalData false), only
 * scenario files are opened.
 */
export default defineComponent({
    emits: {
        /** a day of the learner's own data to look at */
        day: (_events: PatientEvent[]) => true,
        /** a scenario file, as parsed JSON, with an id for it */
        scenario: (_scenario: ReturnType<typeof scenarioFromFile>) => true,
    },

    data() {
        return {
            /** whether the learner's own data can be opened */
            personalData: buildInfo.personalData,
            ownDataNotice: OWN_DATA_NOTICE,
            /** names of the files of the day shown */
            fileNames: "",
            /** format of the files, e.g. "Dexcom Clarity export" */
            fileSource: "",
            /** what was not used or assumed when reading the files */
            fileNotes: [] as string[],
            /** all events of the files */
            fileEvents: null as PatientEvent[] | null,
            /** days covered by the files */
            fileDays: [] as Date[],
            /** index of the day looked at */
            selectedDay: 0,
            /** problem with the last files */
            error: "",
        }
    },

    methods: {
        /** forgets the files, e.g. when a practice scenario is chosen */
        clear() {
            this.fileNames = ""
            this.fileNotes = []
            this.fileEvents = null
            this.fileDays = []
            this.error = ""
        },

        /**
         * reads the chosen files; the events of several files (e.g.
         * Nightscout entries and treatments) are combined
         */
        async onFilesSelected(event: Event): Promise<void> {
            const input = event.target as HTMLInputElement
            const files = Array.from(input.files ?? [])
            if (files.length === 0) {
                return
            }
            const texts = await Promise.all(files.map((file) => file.text()))
            // allows the same file to be selected again later
            input.value = ""

            // a scenario file shared by an educator
            if (files.length === 1 && this.openScenarioFile(texts[0], files[0].name)) {
                return
            }
            if (!this.personalData) {
                this.error = `${files[0].name} is not a scenario file. This version `
                    + "of SweetSpot opens practice scenarios from your educator only, "
                    + "not your own data."
                return
            }

            const events: PatientEvent[] = []
            const sources = new Set<string>()
            const notes: string[] = []
            for (const [i, file] of files.entries()) {
                try {
                    const data = readPatientData(texts[i])
                    events.push(...data.events)
                    sources.add(data.source)
                    notes.push(...data.notes)
                } catch (err) {
                    this.error = `We could not read ${file.name}. `
                        + `${(err as Error).message}. Check the file and try again.`
                    return
                }
            }
            this.error = ""
            this.fileNames = files.map((file) => file.name).join(", ")
            this.fileSource = [...sources].join(" and ")
            this.fileNotes = notes
            this.fileEvents = sortByTime(events)
            this.fileDays = getDays(this.fileEvents)
            this.loadDay(0)
        },

        /**
         * Opens the text as a scenario file, if it is one.
         * @returns true if it is a scenario file (opened, or with an error
         *      shown), false if it is another file
         */
        openScenarioFile(text: string, name: string): boolean {
            let data: unknown
            try {
                data = JSON.parse(text)
            } catch {
                return false
            }
            if (!isScenarioFile(data)) {
                return false
            }
            try {
                const scenario = scenarioFromFile(data, new Date(), "shared-" + name)
                this.clear()
                this.$emit("scenario", scenario)
            } catch (err) {
                this.error = `We could not open the scenario in ${name}. `
                    + `${(err as Error).message}.`
            }
            return true
        },

        /** shows one day of the files */
        loadDay(index: number) {
            const all = toRaw(this.fileEvents) ?? []
            const days = toRaw(this.fileDays)
            this.selectedDay = index
            this.$emit("day", days.length > 1 ? eventsForDay(all, days[index]) : all)
        },

        /** name of a day for the day picker, e.g. "Monday 5 October" */
        dayName(day: Date): string {
            return day.toLocaleDateString("en-GB",
                { weekday: "long", day: "numeric", month: "long" })
        },
    },
})
</script>


<template>
    <div v-if="personalData" class="lt1-csv-input">
        <h3>Or use your own day</h3>
        <p class="ss-hint" id="uploadHint">
            Upload a file with your insulin, food and glucose readings: a
            SweetSpot CSV file, or an export from LibreView, Dexcom Clarity or
            Nightscout (you can choose the entries and treatments files
            together). It stays on this device. You can also open a scenario
            file from your educator.
        </p>
        <label for="csvUpload">Upload a file</label>
        <input type="file" id="csvUpload" accept=".csv,.txt,.json" multiple
            aria-describedby="uploadHint" @change="onFilesSelected" />
        <div v-if="fileNames && !error" class="ss-hint">
            <p>Using {{ fileNames }} ({{ fileSource }}).</p>
            <ul v-if="fileNotes.length" class="file-notes">
                <li v-for="note in fileNotes" :key="note">{{ note }}</li>
            </ul>
        </div>
        <div v-if="fileEvents && !error" class="ss-inset own-data-notice">
            {{ ownDataNotice }}
        </div>
        <p v-if="error" class="csv-error" role="alert">{{ error }}</p>
        <div v-if="fileDays.length > 1" class="day-picker">
            <label for="daySelect">Day to look at</label>
            <p class="ss-hint" id="dayHint">
                The file covers {{ fileDays.length }} days. Choose one day to
                look at.
            </p>
            <select id="daySelect" aria-describedby="dayHint" :value="selectedDay"
                @change="loadDay(Number(($event.target as HTMLSelectElement).value))">
                <option v-for="(day, index) in fileDays" :key="index" :value="index">
                    {{ dayName(day) }}
                </option>
            </select>
        </div>
    </div>

    <div v-else class="lt1-csv-input">
        <h3>Or open a scenario from your educator</h3>
        <p class="ss-hint" id="uploadHint">
            Open a scenario file your educator has shared with you. This
            version of SweetSpot does not open your own data.
        </p>
        <label for="csvUpload">Open a scenario file</label>
        <input type="file" id="csvUpload" accept=".json"
            aria-describedby="uploadHint" @change="onFilesSelected" />
        <p v-if="error" class="csv-error" role="alert">{{ error }}</p>
    </div>
</template>


<style scoped>
.lt1-csv-input {
    margin: 1.5rem 0 1rem 0;
    padding-top: 1rem;
    border-top: 1px solid var(--ss-border);
}

.file-notes {
    padding-left: 1.25rem;
    margin-bottom: 0.75rem;
}

.day-picker {
    margin-top: 0.75rem;
}

.day-picker select {
    display: block;
    width: 100%;
    box-sizing: border-box;
}

.lt1-csv-input input[type=file] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    border: none;
    padding-left: 0;
}
</style>
