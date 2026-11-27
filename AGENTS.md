# AGENTS.md — development workflow

Rules for anyone (human or AI agent) changing this repository. Read this
before you branch, commit, open a PR or think about deploying.

## Branches and environments

| Branch | Role | Deploys to | How |
|---|---|---|---|
| `main` | Production. Only reviewed work from `dev`. | https://study.danielperr.com (Worker `study-deadlines`) | Automatically, by GitHub Actions, on every push to `main` |
| `dev` | Trunk. Default base for all work. | https://study-deadlines-dev.study-deadlines.workers.dev (Worker `study-deadlines-dev`) | Automatically, by GitHub Actions, on every push to `dev` |
| `claude/*`, `feat/*`, `fix/*`, … | Short-lived work branches | Nowhere | — |

**Production deploys only from `main`.** Nothing else ever reaches
study.danielperr.com.

**`dev` deploys only from `dev`.** It is the place to see work in progress
running for real.

## Deployment policy

- Deploys happen **only** through the GitHub Actions workflow
  [.github/workflows/ci.yml](.github/workflows/ci.yml), triggered by a push to
  `main` or `dev`. There are no other deploy paths.
- **Manual deployments are forbidden.** Do not run `wrangler deploy`,
  `wrangler versions upload`, `wrangler versions deploy`, `wrangler rollback`,
  `wrangler preview` or any other command that publishes, from a laptop, an
  agent session or anywhere else. There are deliberately no `deploy` npm
  scripts, and agents are blocked from these commands in
  [.claude/settings.json](.claude/settings.json).
- Want something on the dev site? Merge it into `dev`.
  Want it in production? Promote `dev` to `main` (below).
- To undo a bad release, revert the commit on the branch (`git revert`) and push;
  the build redeploys. The one exception is an emergency rollback of production
  when a revert can't land fast enough: only the project owner does that, by hand,
  from the Cloudflare dashboard, and follows up with a revert on `main` so git and
  production agree again.

## Lifecycle of a change

1. **Branch from `dev`.**
   `git fetch origin && git switch -c claude/<short-topic> origin/dev`
2. **Build it, test first.** Write or update tests in `tests/` before the code
   (see the TDD rule in the user's global instructions). Keep `npm test` green.
3. **Check it locally.** `python3 tools/serve.py` serves the app at
   http://localhost:8173. Run `npm run build` if you touched anything the build
   or service worker cares about (`tests/sw.test.js` and `tests/build.test.js`
   catch a module missing from the offline cache).
4. **Open a PR into `dev`.** Conventional-commit messages
   (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`).
   The PR description says what changed and how it was tested.
5. **Merge into `dev`.** The dev site updates by itself within a few minutes.
   Look at the change there (phone too: it's a PWA).
6. **Promote to production.** When `dev` is in a releasable state, open a PR
   **`dev` → `main`**. Merge it with a merge commit (not squash), so `main` and
   `dev` share history and the next promotion is clean. Production updates by
   itself.
7. **Delete the work branch.**

### Hotfixes

Production is broken and `dev` has unreleased work you don't want to ship yet:
branch from `main` (`fix/<topic>`), PR into `main`, then immediately merge
`main` back into `dev` so the fix isn't lost on the next promotion. This is the
only time a work branch targets `main`.

## Rules for AI agents

- Your working base is **`dev`**. Never commit directly to `main` and never open
  a PR into `main` except a `dev` → `main` promotion or a hotfix the user asked
  for.
- Never deploy. "Deploy to dev" means "get it merged into `dev`"; "deploy to
  prod" means "promote `dev` to `main`". Ask before merging either.
- Never push to `main` or `dev` directly; go through a PR.
- Never force-push `main` or `dev`.
- `npm test` must pass before you open a PR.
- Do not change `wrangler.jsonc` routes or environments without the user asking.
  The `dev` environment must keep `"routes": []` so it can never claim the
  production domain.

## Deployment pipeline (GitHub Actions)

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every PR into
`dev`/`main` and every push to them:

| Trigger | Job `check` | Job `deploy` |
|---|---|---|
| PR into `dev` or `main` | `npm ci`, `npm test`, `npm run build` | — |
| Push to `dev` | same | `wrangler deploy --env dev` → Worker `study-deadlines-dev` (GitHub environment `dev`) |
| Push to `main` | same | `wrangler deploy` → Worker `study-deadlines` (GitHub environment `production`) |

A failing test or build fails `check`, and nothing is deployed. Deploys for the
same branch never overlap (a newer push waits).

Secrets live in GitHub → Settings → Environments, one Cloudflare token per
environment so each can touch only its own Worker:

| Where | Secret | Value |
|---|---|---|
| Environment `dev` → Environment secrets | `CLOUDFLARE_API_TOKEN` | Token scoped to Worker `study-deadlines-dev` |
| Environment `production` → Environment secrets | `CLOUDFLARE_API_TOKEN` | Token scoped to Worker `study-deadlines` plus zone `danielperr.com` (custom domain) |
| Settings → Secrets and variables → Actions → Repository secrets | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (not a secret, shared by both) |

Do not add a repository-level `CLOUDFLARE_API_TOKEN`: an environment secret
overrides a repository secret with the same name, but a missing environment
secret would silently fall back to it. Each environment's deployment branch
rule should allow only its branch (`dev` → `dev`, `production` → `main`).
The deploy job fails with a clear error if a secret is missing.

Cloudflare Workers Builds (the dashboard Git integration) must stay
**disconnected** on both Workers, or every push deploys twice.

### Debugging a failed run

Agents may read and re-run workflow runs; re-running redeploys the same commit
and is the one allowed way to retry a deploy.

```bash
gh run list --workflow ci.yml --limit 5
gh run view <run-id> --log-failed
gh run rerun <run-id> --failed
```

Editing the workflow is a normal change: branch from `dev` and open a PR.

## Project basics

See [README.md](README.md) for what the app is, how to run it and how the code
is laid out.
