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

## Known issues

See the [accessibility statement](../src/frontend/assets/pages/accessibility.html): showing and hiding a change in
the chart legend works only with a mouse or by touch.
