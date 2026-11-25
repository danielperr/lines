# UI overhaul: style C (color-coded cards)

Status: planned, not started. Base: `review` @ 6c09010 (course-first model).

## Decisions

| Topic | Decision |
| --- | --- |
| Style | C: each course has a color; chunky rounded cards, pill badges |
| Course colors | Assigned automatically, editable (swatch row in the edit sheet and the wizard) |
| Today list | One card per course, with that course's tasks inside |
| Scope | Whole app, one phase per commit |
| Color schemes | Light and dark, following the system setting |

## Technical approach

- **Color as data.** `course.color` is an optional palette key (`'violet'`, `'amber'`, ...),
  never a hex value. A missing key resolves to a fallback picked from the course's index, so
  stored v5 data stays valid with no version bump or migration. `validateCourse` rejects
  unknown keys.
- **Color as CSS.** Elements get `data-color="<key>"`. One rule per key sets
  `--course-solid`, `--course-on` (text on the solid color), `--course-tint` and `--course-ink`
  (text on the tint), with dark-mode overrides. Components only read `--course-*`, so adding a
  color means adding one CSS block and one palette entry.
- **Text contrast.** Light hues (amber, teal, green) use dark text on the solid color; deep hues
  (violet, blue, coral) use white. Every pair needs at least 4.5:1 contrast in both modes,
  checked by a unit test on the palette table.
- **Avoid too many solid blocks.** Solid fills only on Today cards and the detail header.
  Course-list rows use the tint plus a solid dot or stripe, so the home screen isn't a wall of
  saturated color.
- **Stylesheet.** Stays a single `styles.css` (about 570 lines). New tokens go at the top.
  Split it only if it grows past about 800 lines; that would also need edits to `sw.js` and
  `tools/app-shell.mjs`.

## Phases

1. **Palette and data (TDD).** `src/course/color.js`: `PALETTE` (8 keys with light and dark
   values), `courseColor(course, index)`, `nextColor(courses)` (least-used key first). Add
   `color` validation to `course.js`; new courses get `nextColor` in the wizard and store.
   Tests: fallback, least-used choice, validation, contrast check. No UI change.
2. **Tokens and base.** Update the `:root` tokens: 18px card radius, pill radius, heavier
   headings (800 for the screen title), larger section spacing. Add the `[data-color]` blocks.
   Restyle shared parts: buttons, steppers (pill `+1` on colored backgrounds), progress bar,
   FAB, toast.
3. **Home.** Header with a status pill ("On track" / "2 behind") and the weekly-hours chip.
   Today: a `todayCards(tasks)` model function (TDD) that groups tasks by `courseId`, keeping
   priority order by each course's first task. One solid card per course, tasks as rows inside,
   translucent `+1` pills. Courses list: tinted cards with a color dot, status pill and thin
   progress bar. Restyle the empty state and the welcome card.
4. **Course detail.** Header band in the course's solid color (name, status, progress). Lectures,
   milestones and timeline as rounded cards on the sheet background, with the course color as the
   accent for steppers, links and the timeline "today" marker.
5. **Sheets and forms.** Swatch picker (radio group of colored circles, keyboard-accessible) in
   the edit sheet and the wizard's first step. Rounded inputs and pill buttons; the save button
   uses the course color when there is one. The milestone sheet inherits the color of the course
   it belongs to.
6. **Polish and verification.** Check light and dark mode on a 375px viewport, focus rings,
   reduced motion, long course names, a 9th course (palette wraps around). Bump the service
   worker cache. Screenshots for review.

## Risks

- Contrast of white text on mid-tone hues in dark mode: the palette test catches it.
- Hard-coded colors left over in `styles.css` (`--ok`/`--tight`/`--behind`): status colors stay
  semantic and are only used inside pills, never as course colors.
- Wizard step order: adding color to step 1 changes `course-wizard.test.js` expectations.
