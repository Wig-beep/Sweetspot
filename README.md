<p align="left">
  <a href="https://lt1.org/" target="_blank">
    <img alt="LoopInsighT1" src="./src/frontend/assets/images/LT1_logo.png" width="200">
  </a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![PR's welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://LT1.org/contribute)
![Test](test/badge.svg)

<hr/>

This software is intended for closed-loop simulation of automatic insulin delivery systems for type 1 diabetic persons.

# Demo and further information
For a live demo, visit the project website [https://LT1.org](https://lt1.org/simulator).

# Installation / Quick start
Follow these instructions to use the simulator locally and modify its source code.

* Install Node.js 20 or newer (22 recommended, see `.nvmrc`) and npm
* Clone repository and enter your local directory.
* Install project dependencies:

```shell
npm install
```
* Run webpack server:

```shell
npm run serve
```
* Open browser and visit [http://localhost:8080/SweetSpot.html](http://localhost:8080/SweetSpot.html).
* Load a patient data CSV (see [examples/PatientData/SampleDay.csv](examples/PatientData/SampleDay.csv) for a pump day
  and [examples/PatientData/SampleDayMDI.csv](examples/PatientData/SampleDayMDI.csv) for an MDI day).
  Each row is one event: `time,type,value,duration,insulin` with time as `YYYY-MM-DD HH:MM` and type one of
  * `basal`: basal rate in U/h, held until the next basal row
  * `bolus`: insulin bolus in U
  * `carbs`: carb intake in g, optionally eaten over `duration` minutes
  * `longacting`: long-acting insulin injection in U; `insulin` is one of `glargine` (default), `glargine_u300`,
    `degludec` or `detemir` (brand names such as Lantus, Toujeo, Tresiba or Levemir are accepted too)
  * `glucose`: measured glucose in mmol/L, shown on the glucose chart

  The older layout `time,basal,bolus,carbs` (one row sets the basal rate and may contain a bolus and a meal) is still accepted.
  The simulation runs from the first event until 6 hours after the last one.

  Long-acting insulin is released over many hours using simplified profiles (see
  [src/common/LongActingInsulin.ts](src/common/LongActingInsulin.ts)); these are educational approximations, not
  validated pharmacokinetic models. The long-acting injections of the first day are assumed to have been taken on the
  preceding days too, so that the simulation starts with long-acting insulin on board.
* Now edit the source files, save your changes, and simply reload website.

If you want to build an independent bundle that can be integrated into an html document, run

```shell
npm run build
```

# License
See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).
