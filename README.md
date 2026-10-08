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

**SweetSpot** (`SweetSpot.html`) is an educational tool built on it: it helps adults with type 1 diabetes taking part
in structured education, such as DAFNE, learn general principles of insulin and food management, by showing how the
glucose of a made-up person responds to insulin, food and exercise. It is used alongside the course and the advice of
the learner's diabetes team. It does not calculate, recommend or check any dose, and does not predict anyone's
glucose. See the [intended purpose](docs/clinical-safety/01-intended-purpose.md).

## Clinical safety and regulation

If SweetSpot is offered through the NHS, it needs a clinical safety case (DCB0129, and DCB0160 for each deploying
organisation), and the MHRA should confirm that it is not a medical device. Draft documents for a Clinical Safety
Officer to review and own are in [docs/clinical-safety](docs/clinical-safety/README.md): intended purpose, clinical
risk management plan, hazard log, safety case report, MHRA qualification pack, and deployment and DTAC notes.

SweetSpot is configured when it is built:

* `SWEETSPOT_PERSONAL_DATA=off` builds the educational-only version, which does not open the learner's own data
  (practice scenarios and educators' scenario files only). It is recommended for NHS deployments until the MHRA has
  given its view on the standard version.
* `SWEETSPOT_FEEDBACK_URL` (an `https:` or `mailto:` address) is shown in the footer for reporting a problem or a
  safety concern.

The version (`sweetspotVersion` in `package.json`) and the commit are shown in the footer of every page. CI tests
both the standard and the educational-only version.

The build includes an accessibility statement (`accessibility.html`) and a privacy notice (`privacy.html`), both drafts
for the providing organisation to complete; see [docs/accessibility-testing.md](docs/accessibility-testing.md) for
the manual accessibility checks.

`npm run build` makes the production build, which contains SweetSpot only (the development pages are in the
development server, or with `SWEETSPOT_ALL_PAGES=on`). `npm run typecheck` checks the types of the `.ts` and
`.vue` files, which the build does not report completely; CI runs it. Releases are made as described in
[docs/RELEASING.md](docs/RELEASING.md).

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
  Each scenario ends with a short question ("Which change avoids the hypo?") with feedback on the answer chosen and
  a button to see that answer on the charts. A unit test checks that the right answer is always the choice with the
  most time in range, so the feedback stays true if doses are changed.
* Tools for educators are hidden for learners: select "Show tools for educators" at the bottom of the page (the
  choice is remembered on the device), or open the page with `?educator` (`SweetSpot.html?educator`). They include
  the settings of the virtual person.
* Educators can make their own scenarios under "For educators: make and share a scenario": start from the day
  shown, write the title, story and things to remember, add changes made in the timeline as changes to try, and
  optionally a question. Scenarios are tried out on the page, saved as a file (opened by learners with
  "Upload a file") or shared as a link. They hold only the texts and the entries as times of day, with no dates
  (see [src/common/ScenarioFiles.ts](src/common/ScenarioFiles.ts)); a link holds the scenario after the `#`, which
  browsers do not send to the server. Files and links are checked strictly when opened.
  "Print a summary" prints the scenario, the charts and the day summary for group sessions.
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
* Exports of diabetes apps are read directly (see [src/common/DeviceExports.ts](src/common/DeviceExports.ts)):
  * LibreView CSV (FreeStyle Libre): sensor, scanned and finger-prick glucose, quick-acting and long-acting insulin
    and carbs in grams. Dates are read day first (UK), or month first if they have AM or PM (US).
  * Dexcom Clarity CSV: sensor glucose and calibrations, quick-acting and long-acting insulin, carbs and exercise
    (light, medium and heavy are read as 30, 50 and 70 % effort).
  * Nightscout JSON downloaded from its API (`/api/v1/entries.json` and `/api/v1/treatments.json`, which can be
    chosen together): glucose, boluses, carbs, exercise and xDrip+ injections. Pump basal changes are not used,
    since the pump's basal profile is not in the download.

  Sample files of the same made-up day are in [examples/PatientData](examples/PatientData):
  [SampleDayLibreView.csv](examples/PatientData/SampleDayLibreView.csv),
  [SampleDayDexcomClarity.csv](examples/PatientData/SampleDayDexcomClarity.csv), and
  [SampleDayNightscout-entries.json](examples/PatientData/SampleDayNightscout-entries.json) with
  [SampleDayNightscout-treatments.json](examples/PatientData/SampleDayNightscout-treatments.json).
  They follow the layout of each export, but contain no real data.

  The page says which format was read and what was not used or assumed (for example, background insulin without
  a name is taken as glargine).
  Files covering several days (for example sensor exports) are looked at one day at a time. Glucose readings
  are hidden in the timeline at first, so that the doses, food and exercise stand out.
  The simulation runs from the first event until 6 hours after the last one.

  To try a what-if, edit the patient timeline (e.g. move a bolus earlier or change a dose) and apply the changes:
  the glucose chart then shows the logged day (dashed) next to the what-if day, and the day summary compares
  time in range, hypos, mean glucose, insulin and carbs. Every what-if is kept as a curve (the latest one bold);
  select a curve in the legend to show or hide it.
  The insulin chart shows quick-acting insulin on board, estimated as bolus advisors do (exponential action curve,
  peak at 75 minutes, 5 hours duration), which makes stacked corrections visible.
  Days are simulated in a background thread (a Web Worker), so the page keeps responding; the original day is only
  simulated again when the day or the virtual person settings change.

  The production build can be installed as an app and works offline once opened (a progressive web app): a
  service worker keeps the files SweetSpot needs on the device (see
  [src/frontend/assets/service-worker.js](src/frontend/assets/service-worker.js) and
  [util/ServiceWorkerPlugin.ts](util/ServiceWorkerPlugin.ts)). Pages are fetched from the network when online, so
  updates arrive; a new version takes over once all SweetSpot pages are closed. Service workers need HTTPS (or
  localhost), so the page must be served over HTTPS to be installed. The development server does not use one.

  Long-acting insulin is released over many hours using simplified profiles (see
  [src/common/LongActingInsulin.ts](src/common/LongActingInsulin.ts)); these are educational approximations, not
  validated pharmacokinetic models. The long-acting injections of the first day are assumed to have been taken on the
  preceding days too, so that the simulation starts with long-acting insulin on board.
* Now edit the source files, save your changes, and simply reload website.

To run the tests: `npm test` runs the unit tests (mocha), `npm run test:components` the unit tests of the Vue
components (Vitest, in [test/components](test/components)), and `npm run test:e2e` builds the app and runs the
end-to-end tests in [e2e](e2e): the main learner journeys and accessibility checks (including keyboard only, visible
focus, reflow at 320px, text spacing, high contrast and reduced motion), on a desktop and a phone screen, in Chromium
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
