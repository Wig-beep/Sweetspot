# Accessibility testing

Automated checks (axe-core, WCAG 2.2 AA) run in CI for every change, in Chrome and Safari at computer and phone
sizes (`e2e/sweetspot.spec.ts`). They find only part of the problems. Before SweetSpot is offered to learners, and
after large changes to the page, test it by hand as below, record the results (date, version from the footer,
device, assistive technology, findings) and update the [accessibility statement](../src/frontend/assets/pages/accessibility.html).

Ideally, include people who use assistive technology in the usability session (#23).

## Journeys to test

1. Read the introduction and hide it.
2. Choose a practice scenario, read it, try a change, and find the result in the day summary.
3. Answer the question at the end of a scenario, including checking without an answer.
4. Open your own file (e.g. `examples/PatientData/SampleDayMDI.csv`), change an amount in "Edit the day yourself",
   make a mistake on purpose (e.g. -3), correct it and show the change.
5. As an educator, make a scenario, save it as a file and copy a link.
6. Print a summary.

## Checks

| Check | How | What to look for |
|---|---|---|
| Keyboard only | Tab, Shift+Tab, Enter, Space, arrow keys; no mouse | Skip link first; every control reachable and usable; focus always visible (yellow); focus moves to error summaries and quiz feedback; nothing traps focus; the sheet on small screens closes with Escape |
| Screen readers | NVDA with Firefox or Chrome (Windows), VoiceOver with Safari (Mac, iPhone), TalkBack with Chrome (Android) | Headings make sense as a list (h1, then h2 for the two sections); results are announced after a change; chart descriptions describe the day; timeline fields are named after their entry; errors are read out |
| Zoom and reflow | Browser zoom to 400% at 1280px wide; window 320px wide | No sideways scrolling; nothing cut off or overlapping |
| Text spacing | A text spacing bookmarklet (WCAG 1.4.12) | No text cut off |
| High contrast | Windows high contrast mode (contrast themes) | Buttons, fields and focus visible; time in range bars and colour key keep their colours |
| Colours | A colour blindness simulator (e.g. in the browser's developer tools) | Low glucose can be found without colour ("Lowest" labels, dashed line at 3.9); days told apart by line patterns |
| Reduced motion | Turn on reduced motion in the operating system | Sections open without animation |
| Touch | A phone, with and without zoom | Targets easy to hit; the "Try a change" sheet and "Show this change" bar do not hide what you are working on |

## Automated in CI

These checks of the list above run in a real browser for every change (`e2e/accessibility.spec.ts`; component
checks in `test/components`):

| Check | Test |
|---|---|
| Keyboard only | A scenario and a change chosen with Tab, arrows and Enter; every stop to the end of the page has a visible focus; the focus never gets stuck (Chromium) |
| Reflow | Nothing scrolls sideways at 320px wide, with a change, the timeline and the tools for educators open |
| Text spacing | With the spacing of WCAG 1.4.12, no text is cut off and nothing scrolls sideways |
| High contrast | No axe problems in forced colours; time in range bars keep their colours (Chromium) |
| Reduced motion | Sections open without animation |
| Structure | One h1, the headings in order, banner, main and footer landmarks, chart descriptions |
| Errors | The field with a problem is marked invalid and described by the message; the error summary moves to it |

## Results

| Date | Version | What | Findings |
|---|---|---|---|
| 8 October 2026 | 0.1.0 and later (dev) | Automated checks above, in Chrome, Safari, Pixel 7 and iPhone 15 sizes | Fixed: the page scrolled sideways by 1px at 320px wide (chart sections took the canvas's default 300px); "Show tools for educators" had no visible focus; problems with an amount or a duration marked the time field as invalid, and the error summary moved to the time field |

Still to do, by people: screen readers (NVDA, VoiceOver on Mac and iPhone, TalkBack), browser zoom and Windows high
contrast on real devices, a colour blindness simulator, touch on real phones, and testing with people who use
assistive technology (#40, #23).

## Known issues

See the [accessibility statement](../src/frontend/assets/pages/accessibility.html). The legend drawn on each chart
works only with a mouse or by touch; "Show or hide lines" under each chart does the same with a keyboard (check it
with a screen reader).
