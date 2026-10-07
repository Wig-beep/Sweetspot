# MHRA qualification pack: is SweetSpot a medical device?

> **Status: DRAFT** for the team to check and send to the MHRA. This is the team's own reasoning, not a
> regulatory decision. Check the current MHRA guidance before sending, as UK medical device regulation is
> being updated.

## Why ask

Software is a medical device in the UK if its manufacturer intends it to be used for a medical purpose for
individual people, such as the diagnosis, prevention, monitoring or treatment of a disease (UK Medical Devices
Regulations 2002). Whether SweetSpot is a device depends on its **intended purpose** and on what it does with
data, as described in the MHRA's guidance on stand-alone software and apps and on crafting an intended
purpose for software.

The practice scenarios are clearly educational. Replaying a person's **own** logged data, and showing
alternative doses, is closer to the line, so the team should get the MHRA's view in writing before the
standard version is offered through the NHS.

## What to send

1. The [intended purpose](01-intended-purpose.md).
2. A description of SweetSpot (below), with screenshots of: a practice scenario with a change, the quiz, the
   upload of own data with the notice, and the footer.
3. The two versions (standard, educational-only).
4. The team's reasoning (below) and the questions.

## Description

SweetSpot is a web app for structured diabetes education (such as DAFNE). It shows the glucose of a made-up
person with type 1 diabetes, simulated with a published physiological model (UVA/Padova), in response to insulin
doses and their timing, carbohydrates and exercise. Learners compare a day with alternatives ("what if the
insulin was taken 20 minutes earlier?") and answer questions about general principles.

In the standard version, a learner can also open a day of their own logged data (from a CSV file or exports
from LibreView, Dexcom Clarity or Nightscout). The doses, food and exercise of that day are replayed on the same
made-up person; the model is **not** fitted to the learner. The page says that the results "are not a
prediction for you, and they cannot tell you what dose to take".

SweetSpot does not calculate, recommend or check any dose, does not predict anyone's glucose, does not connect to
any device or clinical system, and sends no data anywhere.

## The team's reasoning

**Educational-only version (no own data):** the software processes only made-up data for teaching general
principles. It is not intended for, and cannot be used for, any decision about an individual's treatment. The
team believes it is **not a medical device**.

**Standard version (own data can be opened):**

- *For the view that it is not a device:* the stated purpose is education alongside a course; the person
  simulated is generic, so the results are not about the learner's physiology; no dose is calculated or
  suggested; the changes compared are those the learner or educator enters; the app says the results are not a
  prediction for the learner.
- *For the view that it could be a device:* it processes an individual's own clinical data (glucose, doses) and
  shows the effect of alternative doses on a glucose curve, which a learner could use to inform their own
  treatment, despite the stated purpose.

## Questions for the MHRA

1. Does the MHRA agree that the educational-only version, as described, is not a medical device?
2. Is the standard version, as described, a medical device? If the answer depends on details (e.g. the wording,
   the use only within courses, the generic model), which ones?
3. If the standard version would be a device, would removing the comparison of alternatives for own data (only
   replaying the day as logged) change the answer?

## After the reply

- Keep the reply with these documents and refer to it in the safety case.
- If the standard version is a device: either deploy only the educational-only version, or plan the conformity
  route (classification, quality management, UKCA marking, registration with the MHRA) before offering it.
- If the intended purpose or features change, check again.

## Draft enquiry

> Subject: Qualification question: educational diabetes simulation software (SweetSpot)
>
> We are developing SweetSpot, a web app used in structured education for adults with type 1 diabetes (such
> as DAFNE). It simulates the glucose of a made-up person in response to insulin, food and exercise, for
> teaching general principles. We attach our intended purpose, a description with screenshots and our
> reasoning. We would be grateful for your view on whether the two versions described are medical devices
> under the UK Medical Devices Regulations 2002, in particular the version that can replay a learner's own
> logged data on the made-up person.
