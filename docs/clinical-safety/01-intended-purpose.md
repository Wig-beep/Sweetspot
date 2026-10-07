# Intended purpose

> **Status: DRAFT** for review by the Clinical Safety Officer and the clinical lead. The wording of the
> intended purpose decides how SweetSpot is regulated, so it must match what the product does and what is said
> about it everywhere (the app, the README, websites, course materials).

## Product

**SweetSpot**, a web app (also installable and usable offline), version 0.1.0 and later. Built on the
open-source LoopInsighT1 simulator (MIT licence).

## Intended purpose

SweetSpot is an **educational tool**. It helps adults with type 1 diabetes who are taking part in structured
education, such as DAFNE (Dose Adjustment For Normal Eating), to **learn general principles** of insulin and
food management, by showing how glucose of a **made-up (virtual) person** responds to insulin doses and their
timing, carbohydrates and exercise.

It is used **alongside a structured education course and the advice of the learner's diabetes team**, and by
diabetes educators to prepare and run teaching sessions.

## Intended users

- Adults with type 1 diabetes on multiple daily injections or an insulin pump, taking part in structured
  education.
- Diabetes educators (e.g. diabetes specialist nurses and dietitians) running such education.

## Intended use environment

On the learner's or educator's own device (computer, tablet, phone), in a course session or at home.

## What SweetSpot does

- Shows practice scenarios: days of a made-up person, with changes to try, things to remember and a short
  question.
- Lets educators write scenarios and share them as files or links.
- In the standard version, lets a learner open a day of their own logged data (CSV, LibreView, Dexcom Clarity or
  Nightscout files) and **replay those doses, food and exercise on the same made-up person**, to talk about the
  principles involved with their educator. The results show how the made-up person responds; the person is not
  personalised to the learner.

## What SweetSpot is not for (contraindications and limitations)

SweetSpot is **not** intended to:

- calculate, recommend, check or adjust any insulin dose, carbohydrate amount or treatment for any person;
- predict or monitor any person's glucose;
- diagnose, prevent, monitor or treat any condition, or replace the advice of a diabetes team;
- be used in an emergency, or to decide how to treat a hypo or high glucose in real life;
- be used by children without an educator, or by people not taking part in structured education.

The app says so on every page ("It shows a made-up person, so it cannot tell you what dose to take. Always
follow the advice of your diabetes team.") and, on days opened from the learner's own data, that the results
"are not a prediction for you".

## Versions for deployment

| Version | Own data | Use |
|---|---|---|
| Standard | Can be opened | Course sessions with an educator; subject to the MHRA's view (see [MHRA pack](05-mhra-qualification.md)) |
| Educational only (`SWEETSPOT_PERSONAL_DATA=off`) | Cannot be opened | Practice scenarios and educators' scenarios only |

**Recommendation:** until the MHRA has confirmed the position for the standard version, NHS deployments use the
**educational-only** version.
