<p align="left">
  <a href="https://lt1.org/" target="_blank">
    <img alt="LoopInsighT1" src="./src/frontend/assets/images/LT1_logo.png" width="200">
  </a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![PR's welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://LT1.org/contribute)
[![Test](https://github.com/Wig-beep/Sweetspot/actions/workflows/test.yml/badge.svg?branch=dev)](https://github.com/Wig-beep/Sweetspot/actions/workflows/test.yml)

<hr/>

This software is intended for closed-loop simulation of automatic insulin delivery systems for type 1 diabetic persons.

# Demo and further information
For a live demo, visit the project website [https://LT1.org](https://lt1.org/simulator).

# Installation / Quick start
Follow these instructions to use the simulator locally and modify its source code.

* Install Node.js 20 or newer (22 recommended, see `.nvmrc`) and npm
* Clone repository and enter your local directory.
* Install project dependencies (exactly the versions in `package-lock.json`):

```shell
npm ci
```
* Run webpack server:

```shell
npm run serve
```
* Open browser and visit [http://localhost:8080/SweetSpot.html](http://localhost:8080/SweetSpot.html).
* Choose a teaching scenario (meal bolus timing, stacking corrections, high-fat meals, exercise, treating a hypo):
  each loads a simulated day of a virtual person on multiple daily injections, with what-ifs to try and key points.
  The scenarios are illustrations for learning, calibrated to the virtual patients, and should be reviewed by diabetes
  educators before use with learners (see [src/common/TeachingScenarios.ts](src/common/TeachingScenarios.ts)).
* Or load a patient data CSV (see [examples/PatientData/SampleDay.csv](examples/PatientData/SampleDay.csv) for a pump day
  and [examples/PatientData/SampleDayMDI.csv](examples/PatientData/SampleDayMDI.csv) for an MDI day).
  Each row is one event: `time,type,value,duration,insulin` with time as `YYYY-MM-DD HH:MM` or `DD/MM/YYYY HH:MM`
  (UK order; other date formats are rejected) and type one of
  * `basal`: basal rate in U/h, held until the next basal row
  * `bolus`: insulin bolus in U
  * `carbs`: carb intake in g, optionally eaten over `duration` minutes
  * `longacting`: long-acting insulin injection in U; `insulin` is one of `glargine` (default), `glargine_u300`,
    `degludec` or `detemir` (brand names such as Lantus, Toujeo, Tresiba or Levemir are accepted too)
  * `exercise`: physical activity with intensity in % of maximal effort, lasting `duration` minutes (default 30).
    The default virtual patient does not respond to exercise, so days with exercise are simulated with the
    Deichmann 2021 exercise model.
  * `glucose`: measured glucose in mmol/L, shown on the glucose chart

  The older layout `time,basal,bolus,carbs` (one row sets the basal rate and may contain a bolus and a meal) is still accepted.
  Cells may be quoted, and files separated by semicolons or tabs are accepted too.
  Files covering several days (for example sensor exports) are looked at one day at a time. Glucose readings
  are hidden in the timeline at first, so that the doses, food and exercise stand out.
  The simulation runs from the first event until 6 hours after the last one.

  To try a what-if, edit the patient timeline (e.g. move a bolus earlier or change a dose) and apply the changes:
  the glucose chart then shows the logged day (dashed) next to the what-if day, and the day summary compares
  time in range, hypos, mean glucose, insulin and carbs. Every what-if is kept as a curve (the latest one bold);
  click on a curve in the legend to show or hide it.

  Long-acting insulin is released over many hours using simplified profiles (see
  [src/common/LongActingInsulin.ts](src/common/LongActingInsulin.ts)); these are educational approximations, not
  validated pharmacokinetic models. The long-acting injections of the first day are assumed to have been taken on the
  preceding days too, so that the simulation starts with long-acting insulin on board.
* Now edit the source files, save your changes, and simply reload website.

To run the tests: `npm test` runs the unit tests, and `npm run test:e2e` builds the app and runs the end-to-end
tests in [e2e](e2e): the main learner journeys and accessibility checks, on a desktop and a phone screen, in Chromium
and in WebKit (the engine of Safari). The first time, install the browsers with
`npx playwright install chromium webkit`.

If you want to build an independent bundle that can be integrated into an html document, run

```shell
npm run build
```

# Dependencies and security

`package-lock.json` is committed, and CI installs exactly what it lists with `npm ci`.
The OpenAPS (oref0) algorithm files are included in [src/vendor/oref0](src/vendor/oref0) instead of installing the
`oref0` package, whose command-line tools bring dependencies with known vulnerabilities.

`npm audit` currently reports high findings in `braces` and `micromatch`, used by the development server's proxy
module (`webpack-dev-server` → `http-proxy-middleware`). No patched versions exist yet. They only run on developers'
machines (`npm run serve`), are not part of the app and are not given outside input.

# License
See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).
