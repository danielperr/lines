# Study planner

An offline-first PWA that tracks whether you're on track in each course.

- **Courses** are the core: each has an optional weekly lecture schedule
  (with breaks, one-off extra and cancelled lectures), a watched count, and
  exams/assignments with optional prep work.
- **On track** means lectures watched as they come out. Prep for an exam or
  assignment starts counting a few days before you'd need to begin it. When
  both apply, the status names both ("3 lectures behind · Midterm prep behind 2h").
- **Today** (the home screen) suggests about a day of work across all
  courses, earliest due first, then lists every course with its status.

See [docs/course-model.md](docs/course-model.md) for the data model, status
rules and migration from older saved data.

## Develop

```bash
python3 tools/serve.py   # http://localhost:8173, no caching
```

```bash
npm test                 # node --test, no dependencies
```

```bash
npm run build            # dist/ with a content-hashed offline cache
```

## Workflow and deploys

Work branches off `dev` and merges back into it by PR; `dev` is promoted to
`main` for releases. Pushes to `dev` deploy the dev site, pushes to `main`
deploy production (study.danielperr.com), both via GitHub Actions (.github/workflows/ci.yml).
Manual deploys are forbidden. Full rules: [AGENTS.md](AGENTS.md).

## Layout

- `src/course/` — pure model and planning (no DOM): schedule, course,
  milestone, store (v5 + migration), planner, status, Today, edits, timeline.
- `src/home-*.js`, `src/course-detail-view.js`, `src/detail-model.js` — screens;
  the `*-model.js` files build all display text and are unit tested.
- `src/*-form.js` — sheet wiring (wizard, course edit, milestone, settings in `app.js`).
- `sw.js` — offline cache; `tests/sw.test.js` fails if a module is missing from `APP_SHELL`.
