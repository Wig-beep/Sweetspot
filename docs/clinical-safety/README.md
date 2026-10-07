# Clinical safety and regulatory documents

> **Status: DRAFT.** These documents were drafted by the development team to prepare for clinical safety
> assurance and a regulatory question. They are **not** a clinical safety sign-off and **not** a regulatory
> decision. They must be reviewed, completed and owned by a named **Clinical Safety Officer (CSO)**, and the
> medical device question must be put to the **MHRA**.

SweetSpot is a learning tool for people on structured diabetes education (such as DAFNE). If it is offered
through the NHS:

- the **manufacturer** (the team that makes SweetSpot) must manage clinical risk under
  **DCB0129** (Clinical Risk Management: its Application in the Manufacture of Health IT Systems);
- each **deploying organisation** (e.g. an NHS trust or a DAFNE centre) must do the same under
  **DCB0160** (Clinical Risk Management: its Application in the Deployment and Use of Health IT Systems);
- the team should confirm with the **MHRA** that SweetSpot, as intended, is **not a medical device**.
  Simulating a person's own data comes closer to that line than the made-up practice scenarios do.

## Documents

| # | Document | Standard | Owner |
|---|---|---|---|
| 1 | [Intended purpose](01-intended-purpose.md) | MHRA, DCB0129 | Manufacturer |
| 2 | [Clinical risk management plan](02-clinical-risk-management-plan.md) | DCB0129 | Manufacturer's CSO |
| 3 | [Hazard log](03-hazard-log.md) | DCB0129 | Manufacturer's CSO |
| 4 | [Clinical safety case report](04-clinical-safety-case-report.md) | DCB0129 | Manufacturer's CSO |
| 5 | [MHRA qualification pack](05-mhra-qualification.md) | UK MDR 2002 | Manufacturer |
| 6 | [Deployment notes and DTAC preparation](06-deployment-and-dtac.md) | DCB0160, DTAC | Deploying organisation (with the manufacturer) |

## Safeguards in the product

These are built into SweetSpot and are referred to as controls in the hazard log:

- the intended purpose and "it cannot tell you what dose to take" in the footer of every page;
- on days opened from the learner's own data, a notice that the results show a made-up person and are not a
  prediction for them;
- a build for clearly educational use that does **not** open the learner's own data
  (`SWEETSPOT_PERSONAL_DATA=off`, see [deployment notes](06-deployment-and-dtac.md));
- the version in the footer, and a way to report a problem or a safety concern (`SWEETSPOT_FEEDBACK_URL`);
- strict checks of uploaded files, timeline entries and shared scenarios;
- automated tests (unit and end-to-end, including accessibility checks), run for every change in CI.

## Keeping these documents current

The hazard log and the safety case refer to a version of SweetSpot. Any change that could affect clinical
safety (see the [plan](02-clinical-risk-management-plan.md#change-control)) must be assessed by the CSO before
release, and these documents updated.
