# Clinical safety case report (DCB0129)

> **Status: DRAFT skeleton.** The Clinical Safety Officer completes, approves and signs this report for each
> release. It must not be issued to a deploying organisation until it is signed.

| | |
|---|---|
| Product | SweetSpot |
| Version | 0.1.0 (commit shown in the app's footer) **[update per release]** |
| Manufacturer | **[TBC]** |
| Clinical Safety Officer | **[TBC]** |
| Date | **[TBC]** |

## 1. Introduction

This report sets out the claim that SweetSpot is acceptably safe for its intended purpose, the arguments for
that claim, and the evidence. It is based on the
[clinical risk management plan](02-clinical-risk-management-plan.md) and the [hazard log](03-hazard-log.md).

## 2. System description

SweetSpot is a static web app that runs entirely on the user's device. It simulates glucose of a made-up
(virtual) person with type 1 diabetes, using the open-source LoopInsighT1 simulator (UVA/Padova model; the
Deichmann 2021 model for exercise). It provides:

- practice scenarios with changes to try, things to remember and a question with feedback;
- scenarios written by educators and shared as files or links;
- in the standard version only: replay of a day of the learner's own logged data on the same made-up person;
- an installable offline app.

No data is sent to any server: files are read on the device, and nothing entered or uploaded leaves it.
There are no accounts, no analytics and no connection to clinical systems.

## 3. Intended purpose

See [intended purpose](01-intended-purpose.md). In short: an educational tool, used alongside structured
education such as DAFNE and the advice of a diabetes team; not for calculating, checking or changing any
person's treatment.

## 4. Clinical risk management

Hazards were identified by the development team from the user journeys and from issues found during
development **[add hazard workshop records with the CSO and clinical lead]**. 19 hazards are logged.

## 5. Safety argument

**Claim:** SweetSpot, version **[x]**, in the **[standard / educational-only]** version, is acceptably safe
for its intended purpose, when deployed as described in the [deployment notes](06-deployment-and-dtac.md).

Arguments:

1. **It does not give treatment advice by design.** It never calculates or proposes a dose; results are for a
   generic made-up person, not fitted to the learner (H01, H16).
2. **Data going in is checked.** Dates, units and values are read strictly, with limits on amounts and on the
   length of a day; anything not used or assumed is listed; nothing is simulated until entries are valid, and
   results that are not possible are not presented as results (H04 to H07, H11, H18, H19).
3. **Results shown match what is on screen.** Results are recalculated when the day or settings change, and
   only the latest simulation is shown (H10).
4. **Users are told what the results are and are not,** in context and on every page (H01, H08, H16, H17).
5. **Clinical content is checked** by tests against the simulation and reviewed by educators (H02, H03, H08).
6. **Problems can be reported and fixed,** with the version visible and change control in place (H13).
7. **Deploying organisations can choose the educational-only version,** which removes the main hazard (H01).

Evidence: the hazard log, and the automated tests run in CI for every change (unit tests in `test/`,
end-to-end tests in `e2e/` in Chrome, Android, Safari and iPhone, including accessibility checks). Attach the
CI run for the release **[link]**.

## 6. Residual risks

| ID | Hazard | Residual R | Justification |
|---|---|---|---|
| H01 | Own data taken as dose advice | 3 (standard), 1 (educational only) | **[CSO]** |
| H02, H03, H08 | Clinical content and limits of the simulation | 2 | Pending educator review (#24) |
| H07 | Device exports | 2 | Pending tests with real exports |
| H11 | Shared scenarios | 2 | Depends on local review process |
| H13 | Old offline version | 2 | **[CSO]** |
| Others | | 1 | Controlled and verified |

## 7. Outstanding actions before release to the NHS

- [ ] Name the CSO and the clinical lead; hold a hazard workshop; agree the ratings.
- [ ] Educator review of scenarios, quizzes and insulin profiles (#24).
- [ ] Usability session with educators and learners, including whether the own-data notice is understood (#23).
- [ ] MHRA view on the standard version ([MHRA pack](05-mhra-qualification.md)).
- [ ] Test imports with real (anonymised) LibreView, Dexcom Clarity and Nightscout exports.
- [ ] Decide on an update message for the offline app (H13).

## 8. Conclusion and sign-off

**[To be written by the CSO.]**

| Role | Name | Signature | Date |
|---|---|---|---|
| Clinical Safety Officer | | | |
| Manufacturer (accountable) | | | |
