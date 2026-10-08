# Deployment notes (DCB0160) and DTAC preparation

> **Status: DRAFT.** For organisations that deploy SweetSpot (e.g. an NHS trust or a DAFNE centre) and for the
> manufacturer preparing for the NHS Digital Technology Assessment Criteria (DTAC).

## Responsibilities of a deploying organisation (DCB0160)

A deploying organisation needs its own Clinical Safety Officer and its own clinical risk management for the
deployment and use of SweetSpot: a deployment plan, a local hazard log and a local safety case. The
manufacturer's [hazard log](03-hazard-log.md) and [safety case report](04-clinical-safety-case-report.md) are
inputs. Local hazards to consider include:

- which version is used (standard or educational-only), and why;
- how educators are trained to introduce SweetSpot and explain its limits to learners;
- whether learners use it only in sessions, or also at home;
- how shared scenarios are reviewed before use with learners (hazard H11);
- how learners and educators report problems, and how reports reach the manufacturer;
- how updates are rolled out and old offline copies replaced (hazard H13).

## Choosing a version

SweetSpot is configured when it is built:

| Setting | Effect |
|---|---|
| `SWEETSPOT_PERSONAL_DATA=off` | Educational-only version: the learner's own data cannot be opened; practice scenarios and educators' scenario files work. **Recommended for NHS deployments until the MHRA has given its view on the standard version.** |
| `SWEETSPOT_FEEDBACK_URL=https://…` or `mailto:…` | Where users report a problem or a safety concern (shown in the footer). Without it, users are asked to tell their diabetes educator. |

```shell
SWEETSPOT_PERSONAL_DATA=off SWEETSPOT_FEEDBACK_URL=mailto:diabetes.education@example.nhs.uk npm run build
```

The built files are in `dist/`. The production build contains **SweetSpot only** (no development pages or
unused images); `SWEETSPOT_ALL_PAGES=on` adds the development pages and must not be used for deployment. The
version and commit are shown in the footer of every page.

## Hosting

- SweetSpot is a set of static files with no server-side processing: any static web hosting works.
- Serve it over **HTTPS** (needed for the offline app and installing).
- No cookies, accounts, analytics or third-party services are used; keep it that way when hosting (e.g. do not
  add tracking scripts).
- Recommended HTTP headers: a Content Security Policy allowing only the site's own scripts, styles, images and
  workers (`default-src 'self'`; inline styles are used by the charts, so `style-src 'self' 'unsafe-inline'`),
  `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` (shared scenario links carry their content
  after the `#`, which browsers do not send, but this adds a safeguard).
- Updates: deploy a new build; users get it when they next open SweetSpot online and close old pages.

## DTAC preparation

| DTAC area | Position | Evidence |
|---|---|---|
| Clinical safety | DCB0129 documents drafted; CSO to approve | This folder |
| Data protection | No personal data is collected, stored or sent by SweetSpot; files are read on the device only. A data protection impact assessment (DPIA) should still record this, including what learners and educators handle on their own devices and in shared scenarios. | Product design; hazard H12 |
| Technical security | Static site; dependencies checked with `npm audit` (remaining findings are in development tools only, see README); secure hosting and headers above. The supplier organisation may need Cyber Essentials and a penetration test of the hosting. | README; CI |
| Interoperability | No connection to clinical systems; reads common export files on the device | `src/common/DeviceExports.ts` |
| Usability and accessibility | Designed to WCAG 2.2 AA with automated checks; NHS digital service manual patterns; usability session planned | e2e accessibility tests; #23 |

## Before going live (checklist)

- [ ] Manufacturer's safety case signed for the version deployed.
- [ ] Deploying organisation's CSO has completed the local safety case.
- [ ] Version chosen; feedback route set.
- [ ] Educators trained, including how to explain that SweetSpot shows a made-up person.
- [ ] Review process for shared scenarios agreed.
- [ ] DPIA completed.
- [ ] Accessibility statement (`accessibility.html`) and privacy notice (`privacy.html`) checked, completed with
      the organisation's details and published; manual accessibility testing done
      ([accessibility testing](../accessibility-testing.md)).
- [ ] Hosting over HTTPS with the recommended headers.
