# Course-first model

The app is organised around **courses** and whether the user is on track in
each one. Exams and assignments are milestones inside a course, not top-level
items.

## Entities (storage v5, key `study-courses:v5`)

```
Course
├── name                      unique, case-insensitive; required for everything
├── schedule | null           weekly lectures (null = course with no lectures)
│   ├── weekdays, startDate, endDate, hoursPerLecture
│   ├── breaks[{from,to}]     ranges with no lectures
│   ├── addedDates[]          one-off extra lectures
│   └── removedDates[]        one-off cancelled lectures (must be a regular lecture day)
├── watched                   lectures watched, oldest first
└── milestones[]
    ├── kind                  exam | assignment
    ├── title, date
    └── prep | null           optional extra work: {unit, total, done, hoursPerUnit}
```

Lecture dates = regular weekdays − breaks − `removedDates` + `addedDates`.
"Cancel this lecture" / "Add lecture on…" go through `withLectureRemoved` /
`withLectureAdded`, which undo each other instead of piling up exceptions.

No semester grouping and no archiving for now.

## On track

- **Lectures (always):** behind = released − watched. Each unwatched lecture is
  due by the next **exam** after it (assignments do not gate lectures), or by
  semester end.
- **Prep (only when relevant):** a milestone with prep gets a computed
  "start by" date (today + spare days, from weekly hours and all competing
  work across courses). Its window opens `PREP_LEAD_DAYS` (3) days before
  that, or as soon as the user logs any prep, or once the milestone has
  passed. Before the window, prep is shown as info only (`nextPrep`:
  "Midterm prep starts Dec 10"); inside it, prep counts toward status.
- **Course status shows both signals once both are relevant** — not just the
  worse one. Lectures must be watched before exam prep, so when the user is
  behind on lectures inside a prep window the status says both are needed,
  e.g. "3 lectures behind · Midterm prep behind 2h".

## Today

`planCourses(state, today).today` fills about one day of study hours
(weekly hours ÷ 7) from released, unwatched lectures and in-window prep,
earliest due first; on a tie lectures come before prep. Consecutive
lectures with the same due date form one task ("Lectures 5–6").

## Screens

1. **Home = Today**: cross-course tasks for today, then the course list
   (status, next milestone, countdown). The + button adds a course.
2. **Course detail**: status, semester timeline (lectures + milestones + now),
   watched stepper, cancel/add lecture, milestones, edit schedule.
3. **Milestone sheet**: kind, title, date, optional "Extra prep before this".

## Migration from v1–v4

`src/course/migrate-v4.js` groups old tracks and deadlines by course name:
tracks → course schedules, deadlines → milestones (linked to a track or
has exam prep → exam; anything else → assignment), unit parts → prep (mixed units merge into
hours), deadlines with no course → "Unsorted". The old key
`study-deadlines:v1` is never overwritten.

## Build phases

1. ✅ Model, schedule exceptions, storage v5, migration (`src/course/`)
2. ✅ Planner: per-course status (both signals), prep window, Today tasks (`planner.js`)
3. ✅ Today + course list screens; wire store into app, add modules to `APP_SHELL`; wizard outputs a course (unique names, optional prep)
4. ✅ Course detail timeline, milestone sheet, cancel/add lecture, course edit sheet (rename, schedule, delete); Undo toast moves into the open sheet so it stays tappable
5. ✅ Removed old deadline/track modules, item dialog, dead styles and their tests (break/extra-lecture tests ported to the course API); toast moved to `src/toast.js`. The offline cache name is content-hashed by the build, so no manual bump is needed.
