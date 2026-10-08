# Hazard log

> **Status: DRAFT**, prepared by the development team for review by the Clinical Safety Officer. Initial
> and residual ratings are **proposals**; the CSO decides them. Ratings use the matrix in the
> [clinical risk management plan](02-clinical-risk-management-plan.md#risk-matrix)
> (S = severity, L = likelihood, R = risk rating).

Version assessed: SweetSpot 0.1.0. Evidence paths are relative to the repository root; e2e tests are in
`e2e/sweetspot.spec.ts` unless stated.

## Summary

| ID | Hazard | Initial R | Residual R | Status |
|---|---|---|---|---|
| H01 | Results of the learner's own data taken as personal dose advice | 3–4 | 3 (standard) / 1 (educational only) | Open: MHRA view, CSO decision |
| H02 | A general lesson applied where it is unsafe | 3 | 2 | Open: educator review (#24) |
| H03 | Scenario, quiz or key point clinically wrong or not in line with the course | 3 | 2 | Open: educator review (#24) |
| H04 | Dates of logged data misread, so doses are at the wrong time | 3 | 1 | Controlled |
| H05 | Glucose units mixed up (mg/dL and mmol/L) | 2 | 1 | Controlled |
| H06 | Impossible or mistyped values entered | 2 | 1 | Controlled |
| H07 | Data in a device export missed, misread or assumed | 3 | 2 | Open: test with real exports |
| H08 | Limits of the simulation not understood (numbers taken as exact) | 3 | 2 | Open: educator review (#24) |
| H09 | Insulin on board shown differs from the learner's pump or app | 2 | 1 | Controlled |
| H10 | Results shown that do not belong to the current day or settings | 3 | 1 | Controlled |
| H11 | Unsafe or wrong content in a scenario shared by an educator | 3 | 2 | Open: local review process (deployment) |
| H12 | Personal data shared in an educator's scenario | 2 | 1 | Controlled |
| H13 | An old version with a known problem stays in use offline | 2 | 2 | Open: consider an update prompt |
| H14 | Results misread because of accessibility barriers | 2 | 1 | Controlled |
| H15 | No results, or the page stops responding | 2 | 1 | Controlled |
| H16 | "Better" or "worse" in the summary read as a recommendation | 2 | 1 | Controlled |
| H17 | A printed summary used outside the course | 2 | 1 | Controlled |
| H18 | Impossible amounts give results that are not possible (e.g. negative glucose) | 3 | 1 | Controlled |
| H19 | A very long period (e.g. a mistyped year) is simulated | 2 | 1 | Controlled |

## Hazards

### H01: Results of the learner's own data taken as personal dose advice

- **Cause:** a learner opens their own logged day, tries a change (e.g. a larger dose) and sees a better
  result for the made-up person, then applies the change to themselves.
- **Effect and harm:** an inappropriate dose; hypo (possibly severe) or high glucose.
- **Initial:** S Major, L Medium → **R 3**; the CSO may judge L High → R 4.
- **Controls:**
  - by design: the simulation uses a generic virtual person, not one fitted to the learner; SweetSpot never
    calculates or proposes a dose; changes are only those the learner or educator enters;
  - by design: the **educational-only version** does not open own data at all (`SWEETSPOT_PERSONAL_DATA=off`);
  - in context: on own-data days, the notice "These results show how a made-up person would respond … They
    are not a prediction for you, and they cannot tell you what dose to take. Talk to your diabetes team
    before changing your doses." next to the upload and above the results;
  - information: intended purpose and disclaimer in the footer of every page; README; course materials.
- **Evidence:** e2e "a CSV file is loaded, and timeline errors are shown before simulating" (notice shown);
  e2e "scenarios do not show the notice for own data"; e2e "the footer states the purpose, the version and how
  to report a problem"; `e2e/education-only.spec.ts` "own data cannot be opened, scenarios work" (run in CI).
- **Residual:** standard version S Major, L Low → **R 3** (undesirable: needs the CSO's justification and the
  MHRA's view); educational-only version, the cause is removed → **R 1**.
- **Actions:** MHRA qualification question ([pack](05-mhra-qualification.md)); deploy the educational-only
  version until then; usability session (#23) to test whether learners understand the notice.

### H02: A general lesson applied where it is unsafe

- **Cause:** a learner applies a principle from a scenario without its conditions, e.g. always injecting
  20 minutes before eating even when glucose is low or falling, or always halving insulin before exercise.
- **Harm:** hypo or high glucose.
- **Initial:** S Considerable, L Medium → **R 3**.
- **Controls:** key points state conditions ("If your glucose is low or falling before a meal, taking insulin
  early can cause a hypo. Follow the advice of your diabetes team."; "Ask your diabetes team how to split
  doses."; "Ask your diabetes team how to plan your insulin and carbs for exercise."); scenarios are used within
  the course with an educator.
- **Evidence:** `src/common/TeachingScenarios.ts` (key points); educator review (#24) **[pending]**.
- **Residual:** S Considerable, L Low → **R 2**.

### H03: Scenario, quiz or key point clinically wrong or not in line with the course

- **Cause:** scenario texts, quiz answers or feedback written by the development team contain an error or
  differ from the DAFNE curriculum (e.g. hypo treatment amounts, correction rules, carb portions).
- **Harm:** wrong learning, leading to hypos or high glucose later.
- **Initial:** S Considerable, L Medium → **R 3**.
- **Controls:** a unit test checks that every quiz has one right answer and that it is the choice with the
  most time in range in the simulation; tests check that each what-if has the effect its text describes; all
  clinical content to be reviewed and approved by DAFNE educators.
- **Evidence:** `test/common/TeachingScenarios.test.ts` ("quizzes", and one test per scenario); review record
  from #24 **[pending]**.
- **Residual (after review):** S Considerable, L Low → **R 2**.

### H04: Dates of logged data misread, so doses are at the wrong time

- **Cause:** 05/10 read as 10 May instead of 5 October; US and UK formats in device exports.
- **Harm:** misleading results (low direct harm, but contributes to H01 and H08).
- **Initial:** S Significant, L High → **R 3**.
- **Controls:** dates are read strictly (YYYY-MM-DD or UK DD/MM/YYYY; other formats rejected rather than
  guessed); LibreView dates are read day first, or month first only with AM/PM; dates that do not exist are
  rejected; the page shows the period simulated in words ("Showing 8am on Monday 5 October …").
- **Evidence:** `test/common/PatientEvents.test.ts` (parseDateTime tests); `test/common/DeviceExports.test.ts`
  (parseLibreViewTime); e2e "UK dates and quoted cells are read correctly".
- **Residual:** S Significant, L Very low → **R 1**.

### H05: Glucose units mixed up (mg/dL and mmol/L)

- **Cause:** a file in mg/dL read as mmol/L, or the reverse.
- **Harm:** misleading readings on the chart.
- **Initial:** S Significant, L Medium → **R 2**; contributes to H01.
- **Controls:** glucose above 35 in SweetSpot CSV files is rejected with "looks like mg/dl, please use mmol/L";
  device exports are converted according to the unit in their column names; Nightscout values (always mg/dL)
  are converted; the app shows mmol/L throughout.
- **Evidence:** `test/common/PatientEvents.test.ts` ("should reject impossible values");
  `test/common/DeviceExports.test.ts` (Clarity in mg/dL, Nightscout); `test/common/GlucoseUnits.test.ts`.
- **Residual:** S Significant, L Very low → **R 1**.

### H06: Impossible or mistyped values entered

- **Cause:** negative amounts, empty fields, exercise above 100 %, durations of 0.
- **Harm:** misleading results.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** every entry is checked (files, timeline, shared scenarios), including upper limits on amounts
  (see H18); nothing is simulated until all entries are valid; errors are listed in an error summary linked to
  the entries.
- **Evidence:** e2e "a CSV file is loaded, and timeline errors are shown before simulating";
  `test/common/PatientEvents.test.ts`; `test/common/ScenarioFiles.test.ts` ("impossible entries").
- **Residual:** S Significant, L Very low → **R 1**.

### H07: Data in a device export missed, misread or assumed

- **Cause:** export layouts differ between app versions and countries; some data is not used (e.g. pump basal
  changes in Nightscout, carbs in servings, alerts); "LO"/"HI" readings set to the sensor's limits; background
  insulin without a name assumed to be glargine.
- **Harm:** misleading results.
- **Initial:** S Significant, L High → **R 3**.
- **Controls:** the format is detected from the contents and named on the page; everything not used or assumed
  is listed ("1 other entries (such as alert) were not used."); unknown files are rejected with a message.
- **Evidence:** `test/common/DeviceExports.test.ts`; e2e "a Dexcom Clarity export is read, saying what was not
  used", "the LibreView sample file is read", "Nightscout entries and treatments are read together".
- **Residual:** S Significant, L Medium → **R 2**.
- **Actions:** test with real exports from learners or educators (anonymised) for each format.

### H08: Limits of the simulation not understood

- **Cause:** the virtual person, the simplified long-acting profiles, fat shown as slow carbs, and a different
  virtual person for exercise give numbers that look exact.
- **Harm:** over-confidence in the numbers; contributes to H01 and H02.
- **Initial:** S Considerable, L Medium → **R 3**.
- **Controls:** "made-up person" wording throughout; model notes on scenarios ("The simulation cannot show fat
  directly …", "This scenario uses a different virtual person who responds to exercise"); summary wording
  compares days rather than giving targets.
- **Evidence:** `src/common/TeachingScenarios.ts` (modelNote); `src/common/LongActingInsulin.ts`; educator review
  of profiles (#24) **[pending]**.
- **Residual:** S Considerable, L Low → **R 2**.

### H09: Insulin on board shown differs from the learner's pump or app

- **Cause:** SweetSpot estimates quick-acting insulin on board with one curve (peak 75 min, 5 h); a learner's
  pump or app may use other settings.
- **Harm:** confusion about how much insulin is active.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** shown for the made-up person and its legend says what it is; README states the settings;
  the scenario explains it as an idea ("shows how much quick-acting insulin is still working").
- **Evidence:** `test/common/InsulinOnBoard.test.ts`; `test/core/LoggedDoses.test.ts`.
- **Residual:** S Significant, L Very low → **R 1**.

### H10: Results shown that do not belong to the current day or settings

- **Cause:** results from earlier settings, an earlier change still shown, or a slow simulation finishing after a
  newer one.
- **Harm:** wrong lesson drawn.
- **Initial:** S Significant, L High → **R 3**.
- **Controls:** settings changes clear earlier changes and simulate again; only the latest simulation is shown;
  the original day's result is reused only if day, period, virtual person and sensor are all unchanged.
- **Evidence:** `test/common/SimulationRequest.test.ts`; e2e "choosing a scenario and trying a change updates
  the results".
- **Residual:** S Significant, L Very low → **R 1**.

### H11: Unsafe or wrong content in a scenario shared by an educator

- **Cause:** an educator's scenario (file or link) has unsafe advice in its texts, wrong doses, or a link is
  altered by someone else.
- **Harm:** wrong learning.
- **Initial:** S Considerable, L Medium → **R 3**.
- **Controls:** shared scenarios are marked "(shared scenario)"; files and links are checked strictly (types,
  amounts, times, limits on length; text is shown as text, never as HTML); the footer and the "practice with a
  made-up person" note are always shown.
- **Evidence:** `test/common/ScenarioFiles.test.ts`; e2e "a scenario is tried out and shared as a link",
  "a damaged link gives a clear message".
- **Residual:** S Considerable, L Low → **R 2**.
- **Actions:** deploying organisations to set how shared scenarios are reviewed before use with learners
  ([deployment notes](06-deployment-and-dtac.md)).

### H12: Personal data shared in an educator's scenario

- **Cause:** an educator builds a scenario from a learner's uploaded day and shares it.
- **Harm:** information governance (not clinical); loss of trust.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** scenarios hold only times of day (no dates), amounts and the texts written; no file names or
  names; a warning in the panel not to write personal details; links carry data after the `#` only.
- **Evidence:** `test/common/ScenarioFiles.test.ts` ("should hold times of day only, and no dates"); e2e "a
  scenario is tried out and shared as a link" (no dates in links).
- **Residual:** S Significant, L Very low → **R 1**.

### H13: An old version with a known problem stays in use offline

- **Cause:** the offline app keeps a copy; a new version takes over only after all SweetSpot pages are closed;
  a device that stays offline keeps the old version.
- **Harm:** a fixed safety problem persists for some users.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** pages are fetched from the network first when online; the version is shown in the footer;
  reports ask for the version.
- **Evidence:** `src/frontend/assets/service-worker.js`; e2e "once opened, it works without a connection".
- **Residual:** S Significant, L Medium → **R 2**.
- **Actions:** consider a message when a new version is ready ("Close and reopen SweetSpot to update").

### H14: Results misread because of accessibility barriers

- **Cause:** colour-only cues, small targets, missing text alternatives.
- **Harm:** a learner misreads which day was better or when glucose was low.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** WCAG 2.2 AA design; line patterns as well as colours; words "better"/"worse" and percentages
  next to colours; text alternatives for charts; automated accessibility checks.
- **Evidence:** e2e "the start page has no WCAG 2.2 AA problems", "a scenario with a change has no WCAG 2.2 AA
  problems", "the educator panel has no WCAG 2.2 AA problems", "timeline fields are named after their entry,
  for screen readers".
- **Residual:** S Significant, L Very low → **R 1**.

### H15: No results, or the page stops responding

- **Cause:** a failure of the background simulation, or a very long simulation.
- **Harm:** inconvenience only.
- **Initial:** S Minor, L Medium → **R 2**.
- **Controls:** simulation in a background thread, falling back to the page; "Working out the results…"; an
  error message if it fails.
- **Evidence:** `src/frontend/util/SimulationClient.ts`; e2e tests run every user journey.
- **Residual:** S Minor, L Low → **R 1**.

### H16: "Better" or "worse" in the summary read as a recommendation

- **Cause:** the day summary marks differences as better or worse for glucose.
- **Harm:** contributes to H01.
- **Initial:** S Significant, L Medium → **R 2**.
- **Controls:** better and worse refer to the made-up person's glucose (time in range, time low); no dose is
  ever marked as right; the own-data notice sits above the results.
- **Evidence:** `src/frontend/LT1Main/ScenarioComparison.vue`; e2e "choosing a scenario and trying a change
  updates the results".
- **Residual:** S Significant, L Very low → **R 1**.

### H17: A printed summary used outside the course

- **Cause:** a printed summary is kept and later read as a plan.
- **Harm:** contributes to H02.
- **Initial:** S Significant, L Low → **R 2**.
- **Controls:** the printout includes the scenario's "practice with a made-up person" note and the footer's
  intended purpose and disclaimer.
- **Evidence:** e2e "the printed summary shows the scenario and results, not the controls".
- **Residual:** S Significant, L Very low → **R 1**.

### H18: Impossible amounts give results that are not possible

- **Cause:** a typing mistake (50 instead of 5.0 units, 5000 instead of 50 g), or a file with absurd values.
  Found by probing: 50 units gave a glucose of -0.8 mmol/L, 1000 units -0.6, and 5000 g of carbs 920 mmol/L.
- **Harm:** a learner sees, and may remember, results that cannot happen; contributes to H08.
- **Initial:** S Significant, L High → **R 3**.
- **Controls:**
  - amounts nobody takes are refused with a clear message: quick-acting insulin above 100 units, background
    insulin above 150 units, pump rate above 10 units an hour, carbs above 500 g, meals and exercise longer than
    24 hours, glucose below 1 mmol/L (files, timeline and shared scenarios);
  - amounts that are valid but much larger than in most days (quick-acting insulin above 25 units, background
    insulin above 80 units, pump rate above 3 units an hour, carbs above 150 g) are simulated, with "Check
    these amounts … Check that it is not a typing mistake." above the results;
  - if the simulated glucose goes below 1 or above 40 mmol/L, the page says the model cannot show what would
    happen and not to read anything into the results.
- **Evidence:** `test/common/PatientEvents.test.ts` ("should reject amounts that nobody takes",
  "getEventWarnings", including that none of the practice scenarios triggers a warning);
  `test/common/GlucoseMetrics.test.ts` ("modelLimitNote"); e2e "amounts nobody takes are refused, large ones
  are questioned", "results that are not possible are not presented as results".
- **Residual:** S Significant, L Very low → **R 1**.
- **Notes:** the limits are proposals for the CSO and the clinical lead to confirm. Scenario 1 of "Taking
  correction doses too close together" reaches 1.2 mmol/L, which is close to the limit of what the model note
  allows; the educator review (#24) should decide whether it is a suitable example.

### H19: A very long period is simulated

- **Cause:** a mistyped year in the timeline or a file (found by probing: a one-year period took 18 seconds and
  gave 526,000 results; the charts could not show it).
- **Harm:** inconvenience; the page may become unusable.
- **Initial:** S Minor, L High → **R 2**.
- **Controls:** entries more than 3 days apart are refused with the dates named ("Check the dates");
  shared scenarios are checked the same way; the simulation refuses periods of more than 4 days.
- **Evidence:** `test/common/PatientDataTimeSpan.test.ts` ("checkTimeSpan");
  `test/common/SimulationRequest.test.ts` ("should refuse periods of more than 4 days"); e2e "entries that are
  too far apart, e.g. a mistyped year, are refused".
- **Residual:** S Minor, L Very low → **R 1**.

