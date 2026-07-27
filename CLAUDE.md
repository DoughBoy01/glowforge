# CLAUDE.md

Project context for Claude Code sessions in this repo. For stack, setup,
architecture, and general gotchas, see [README.md](README.md) — this file
only covers what a session needs that isn't there yet, and the invariants
worth protecting.

## Commands

```bash
npm run dev              # local dev (OpenNext's Cloudflare context, not wrangler dev)
npm run build             # next build
npm run lint               # eslint
npx tsc --noEmit            # typecheck
npm run db:generate          # after any src/db/schema.ts change
npm run db:migrate:local      # apply migrations to local D1
npm run db:migrate:remote      # apply migrations to remote D1 — do this before deploying
npm run deploy                  # opennextjs-cloudflare build && deploy
```

`npm run deploy` builds and ships whatever is currently on disk, uncommitted
or not — it doesn't check git status. Prefer committing first so the
deployed version matches a real commit. Always confirm the remote D1
migration state (`npx wrangler d1 migrations list glowforge-db --remote`)
before deploying if `drizzle/` has new migration files — a deploy that
expects columns the remote DB doesn't have yet will break in production.

## Face age is the mission

[`src/lib/face-age.ts`](src/lib/face-age.ts) is the single source of truth
for face age — the number the whole app is measured against. Two rules are
load-bearing and every screen has to respect them:

1. **Face age is measured against the user's own baseline, never their real
   age.** We don't collect date of birth, so "you look N years younger than
   you are" is a claim we have no data for. The win condition is "fewer
   years than you started with" — compare against `baseline`/`previous` from
   `buildFaceAgeMission`, never invent an absolute target.
2. **Only a scan moves the number.** Routine logging and Face Gym sessions
   are inputs that might move the *next* scan's face age, but copy must
   never claim they directly moved it. See `MISSION_LINK_COPY` in the same
   file for the vocabulary (`measures` / `targets` / `unmeasured`).

Because of (1), face age has no absolute "good score" — there's nothing to
add a `ScoreLevelBadge` to. Its direction (down = win) is instead carried by
`getMissionLine`'s narrative copy and by `DeltaBadge`'s `lowerIsBetter` prop
wherever a face age delta is shown (e.g. the compare page) — don't reuse the
default (higher-is-better) `DeltaBadge` for it.

## Score direction: higher is better, and now it's labeled

The four tracked metrics (`sun_damage`, `firmness`, `eye_area`, `moisture`,
`src/lib/metrics.ts`) and the derived overall score are 0-100, higher always
better. Until recently a bare number like "62" carried no indication of
whether that was good — [`ScoreLevelBadge`](src/components/app/score-level-badge.tsx)
fixes that: it renders `Critical` / `Needs Work` / `On Track` / `Excellent`
off `scoreLevelLabel()` in `src/lib/insights.ts` (same thresholds
`getCategoryPriorities` already used for "Where to focus").

It's wired into every place a raw score/percentage appears without other
context: `MetricCard`, `MetricRail`, `CategoryPriorities`, the `ScoreRing`
usages on the dashboard/results/compare pages, and the "Overall now" stat on
the progress page. If you add a new place that shows a bare 0-100 score,
drop this in rather than a new ad-hoc color.

**Don't use `text-primary`/`bg-primary` for the "on track" tier.** This
app's `--primary` is a neon pink (`#FF2E88` dark / `#D40E67` light) close
enough to `--destructive`'s red that the two are hard to tell apart at badge
size — which defeats the point. `ScoreLevelBadge` uses `accent` (the
palette's cyan, reserved for "data/trust") instead. Check both light and
dark mode if you touch these colors — the confusion was only obvious in
dark mode, which is this app's primary theme.

## Recently built (this branch: `face-age-mission`)

- Face age promoted to the primary metric: `FaceAgeHero` (dashboard),
  `FaceAgeBadge` (results page), `FaceAgeChart` (progress page).
- Goal simulation: `lib/face-simulation.ts` + `lib/goal-simulation.ts`
  generate a projected "goal" image from a scan's concern scores;
  `GoalPreview` component, `db/queries/skin-simulations.ts`,
  `api/simulations/[scanId]/route.ts`.
- `TodayBoard` replaced the old `next-action-card` / `skin-age-badge` /
  `skin-age-chart` components.
- `ScoreLevelBadge` — see above.
