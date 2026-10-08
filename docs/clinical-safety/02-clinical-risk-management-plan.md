# Clinical risk management plan (DCB0129)

> **Status: DRAFT.** To be completed, approved and owned by the manufacturer's Clinical Safety Officer.
> Items marked **[TBC]** need a decision or a name.

## 1. Purpose and scope

This plan describes how clinical risk is managed for **SweetSpot** by its manufacturer, as required by
DCB0129. It covers the SweetSpot web app (standard and educational-only versions), from version 0.1.0, including
the practice scenarios, the quizzes, educators' shared scenarios, the import of logged data and the offline app.

Out of scope: the deployment and use of SweetSpot by an organisation (covered by that organisation under
DCB0160, see [deployment notes](06-deployment-and-dtac.md)), and the LoopInsighT1 simulator pages other than
SweetSpot (not deployed).

## 2. Roles and responsibilities

| Role | Name | Responsibilities |
|---|---|---|
| Top management (accountable) | **[TBC]** | Makes sure clinical risk management is resourced and followed |
| Clinical Safety Officer (CSO) | **[TBC]**, registered clinician with clinical safety training | Owns this plan, the hazard log and the safety case report; approves releases for clinical safety |
| Clinical lead / DAFNE educators | **[TBC]** | Review clinical content (scenarios, quizzes, insulin profiles; issue #24); join hazard workshops |
| Development lead | kingmohd | Implements controls and tests; keeps the hazard log's evidence current; release and change control |

The CSO must be a suitably qualified and experienced registered clinician, with training in clinical risk
management, as DCB0129 requires.

## 3. Clinical risk management process

1. **Hazard identification:** structured workshops (CSO, clinical lead, development) for each release with
   safety-relevant changes, using the intended purpose, the user journeys (scenarios, quizzes, own data,
   educator scenarios, offline use) and "what if" questions (wrong data, wrong understanding, failures).
   New hazards may also come from tests, user reports, incidents and usability sessions (issue #23).
2. **Risk estimation and evaluation:** for each hazard, severity and likelihood of harm are estimated and a
   risk rating taken from the matrix below, before and after controls.
3. **Risk control:** controls are added in this order of preference: by design (the product cannot do the
   unsafe thing), by protective measures (checks, warnings in context), by information (labelling, training).
4. **Verification:** each control has evidence, usually an automated test run in CI for every change, or a
   review record.
5. **Residual risk:** the CSO decides whether each residual risk is acceptable, and records the reasons.
6. **Safety case:** the [clinical safety case report](04-clinical-safety-case-report.md) summarises the
   above for a release and is signed by the CSO.

### Risk matrix

As in the NHS England guidance for DCB0129 and DCB0160 (the CSO to confirm the definitions used):

| Likelihood \ Severity | Minor | Significant | Considerable | Major | Catastrophic |
|---|---|---|---|---|---|
| **Very high** | 3 | 4 | 4 | 5 | 5 |
| **High** | 2 | 3 | 3 | 4 | 5 |
| **Medium** | 2 | 2 | 3 | 3 | 4 |
| **Low** | 1 | 2 | 2 | 3 | 4 |
| **Very low** | 1 | 1 | 2 | 2 | 3 |

| Rating | Acceptability |
|---|---|
| 1 | Acceptable |
| 2 | Acceptable where further reduction is not practical |
| 3 | Undesirable; acceptable only if further reduction is not practical and the benefits outweigh the risk |
| 4 | Unacceptable |
| 5 | Unacceptable |

Severity examples for SweetSpot: *Minor*: confusion or a misunderstanding corrected in the course;
*Significant*: a learner tries an inappropriate change that leads to high glucose or a mild hypo;
*Considerable*: repeated inappropriate changes leading to hypos needing help or prolonged high glucose;
*Major*: a severe hypo or ketoacidosis needing emergency treatment; *Catastrophic*: death.

## 4. Change control

- Every change goes through a pull request or a reviewed commit, with unit and end-to-end tests in CI
  (`.github/workflows/test.yml`).
- A change is **safety-relevant** if it changes: the simulation or its models, imports of data, units,
  dates or validation, texts of scenarios, quizzes or safety information, the intended purpose, the
  configuration of versions, or how updates reach users (service worker).
- Safety-relevant changes are assessed by the CSO **before release**: the hazard log is reviewed and updated,
  and the safety case report is re-issued for the new version.
- Releases are tagged in git (`v0.1.0` and so on) and carry a version (`sweetspotVersion` in `package.json`),
  shown in the app's footer with the commit, so that reports and the safety case can name the exact version.
  The steps are in [RELEASING.md](../RELEASING.md).

## 5. Post-release monitoring and incidents

- Users report problems and safety concerns through the route shown in the footer (`SWEETSPOT_FEEDBACK_URL`,
  set per deployment, or their diabetes educator).
- Reports are logged as issues, triaged by the CSO within **[TBC]** working days, and linked to the hazard log.
- Safety incidents are also reported by the deploying organisation through its own incident process; the
  manufacturer co-operates with the deploying organisation's CSO.
- Fixes for safety issues are released as soon as practical; the service worker brings updates to users when
  they next open SweetSpot online and close old pages.

## 6. Document control

These documents are kept in the repository (`docs/clinical-safety`), so their history is tracked with the
code. Approved versions are tagged with the release they apply to.

## 7. Audit

The CSO reviews this plan at least once a year and after any serious incident **[TBC]**.
