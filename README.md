# GlowForge

Skin performance tracking for men 35+. Sun damage, firmness, eye area, and
moisture, tracked like a training log — not a beauty app.

## Stack

- **Next.js 15** (App Router, TypeScript, React 19)
- **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) — deploy target, not Vercel
- **D1** (SQLite) + **Drizzle ORM** — primary database
- **R2** — progress photos + OpenNext's ISR/data cache
- **Clerk** — auth
- **Stripe** — subscriptions (Free / Pro)
- **PostHog** — product analytics
- **Tailwind CSS v4 + shadcn/ui** (Base UI primitives, not Radix — see note below)
- **Serwist** — PWA / service worker

## Architecture

```
src/
  app/
    (marketing)/        public site — landing, pricing
    (app)/               authenticated app — dashboard, check-in, routine, settings
    scans/[scanId]/       the results page — one scan's full breakdown + action plan
    s/[slug]/             public share cards (viral loop, no auth)
    api/webhooks/         Clerk + Stripe webhook handlers
    api/stripe/            checkout + billing portal session creation
    api/photos/[scanId]/[angle]/  authenticated R2 photo streaming
  db/
    schema.ts             Drizzle schema + relations
    queries/               one file per domain (users, scans, routines, shares, partners, skin-analysis)
  lib/
    metrics.ts             the 4 tracked metrics — single source of truth for labels/weights
    insights.ts             category priorities, skin age deltas, projected scores, windowed trend math
    daily-routine.ts         the recommendation engine — builds the ordered AM/PM routine
    routine-plan.ts           resolves that routine for a scan (shared by page + save action)
    products.ts              curated affiliate product catalog, keyed by concern
    concerns.ts              display copy for YouCam's raw per-concern scores
    skin-analysis.ts        orchestrates one YouCam analysis run and persists it
    youcam/                 YouCam (Perfect Corp) API client — upload, task, poll, transform
    analytics/              PostHog client + server capture helpers
    stripe.ts, constants.ts, ...
  components/
    ui/                    shadcn/ui primitives (generated, don't hand-edit lightly)
    app/, marketing/        feature components
```

**Domain model**: a *scan* (check-in) produces one row per metric
(`sun_damage`, `firmness`, `eye_area`, `moisture`, plus a computed
`overall`) in `metric_scores` — this keeps every trend-chart query a single
`WHERE metric_type = ?` rather than five different shapes. See
[`src/lib/metrics.ts`](src/lib/metrics.ts) for the metric weights and
[`src/db/schema.ts`](src/db/schema.ts) for the full model (routines/streaks,
public shares, partner links for affiliate/sponsor revenue, webhook
idempotency log).

## Local setup

1. **Install and generate Cloudflare types**
   ```bash
   npm install
   npm run cf-typegen
   ```

2. **Environment variables** — copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in real keys from Clerk, Stripe, and PostHog (each service's
   dashboard URL is in the comments). Clerk auto-provisions temporary
   "keyless" dev keys if you skip this — fine for poking at the UI, but you
   can't test webhooks or billing without real keys.

3. **Database** — create the D1 databases and paste their IDs into
   `wrangler.jsonc` (`d1_databases[].database_id` and the `preview` env
   variant), then run migrations locally:
   ```bash
   npx wrangler d1 create glowforge-db
   npx wrangler d1 create glowforge-db-preview
   npm run db:generate        # after any schema.ts change
   npm run db:migrate:local
   ```

4. **R2 buckets**:
   ```bash
   npx wrangler r2 bucket create glowforge-photos
   npx wrangler r2 bucket create glowforge-cache
   ```

5. **Run it**:
   ```bash
   npm run dev
   ```
   `next dev` uses OpenNext's local Cloudflare context (`initOpenNextCloudflareForDev`
   in `next.config.ts`), so D1/R2 bindings work the same as production without
   needing `wrangler dev`.

6. **Webhooks locally** (only needed to test billing/user-sync end to end):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   For Clerk, use its dashboard's local webhook testing (ngrok-style tunnel)
   or just trust `getOrSyncUser`'s fallback path, which lazily syncs a user
   on first authenticated request even if the webhook never fires locally.

## Deploying

```bash
npm run deploy
```

This runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Before
the first deploy:

- Set real `database_id`s in `wrangler.jsonc` (see step 3 above)
- Set secrets: `npx wrangler secret put CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `CLERK_WEBHOOK_SIGNING_SECRET`
- Set public vars (`NEXT_PUBLIC_*`) either in `wrangler.jsonc`'s `vars` block
  or via `npx wrangler secret put` — either works, they just need to be
  present at build time since Next inlines `NEXT_PUBLIC_*` into the client bundle
- Point Clerk's and Stripe's webhook endpoints at the deployed URL
- Apply migrations to the remote database: `npm run db:migrate:remote`

## Notable decisions / gotchas

- **Base UI, not Radix.** The shadcn `base-nova` preset was used, so
  composed elements use `render={<Link .../>}` instead of Radix's
  `asChild` + child pattern. `components/ui/button.tsx` defaults
  `nativeButton={false}` automatically whenever `render` is passed, so you
  don't need to think about it at call sites — just use `render`.
- **No image optimization on Workers.** `next/image` runs `unoptimized:
  true` (`next.config.ts`) since the sharp-based optimizer doesn't run in
  the Workers runtime. If on-the-fly resizing becomes worth it, look at the
  Cloudflare Images product or a `/cdn-cgi/image/...` loader.
- **Server actions do most mutations** (check-in submission, routine
  logging, share creation) rather than API routes — only Stripe/Clerk
  webhooks and the two Stripe session-creation endpoints are real routes,
  since they need to be called from outside Next (webhooks) or return a
  redirect URL to a client component (`fetch` + `window.location`).
- **Webhook idempotency** is a single `webhook_events` table keyed by the
  provider's own event id (Svix delivery id for Clerk, Stripe's `event.id`)
  — both providers retry on non-2xx, so this matters.
- **Marketing pages are dynamic (`ƒ`), not static.** The header renders
  `<Show when="signed-in">` from Clerk, which reads per-request auth state,
  so Next can't prerender those routes. Acceptable for now; if it matters
  later, move the signed-in/out branch into a client-side islands + Suspense
  boundary so the shell stays static.
- **Check-in is selfie-first.** The front photo is the only required input
  in `CheckInForm` — manual sliders are an opt-in, all-or-nothing toggle
  (off by default) rather than always-submitted defaults, so a photo-only
  scan doesn't end up with fake "50" scores masquerading as real data
  (`createScan` takes `Partial<Record<TrackedMetric, number>>` and only
  writes rows for metrics actually provided). Submitting redirects straight
  to `/scans/[scanId]` — the results page — not the dashboard.
- **AI skin analysis (YouCam) runs in the background via `waitUntil`, not
  inline in the request.** The check-in server action uploads photos, saves
  any manual scores immediately, and fires `requestSkinAnalysis` without
  awaiting it — that function calls `ctx.waitUntil(...)` so the ~10-30s
  YouCam upload→task→poll round trip finishes after the redirect response
  is already sent. Both the dashboard and the results page poll
  `GET /api/scans/[scanId]/analysis` (DB-only, never calls YouCam directly)
  every ~2.5s while status is pending/processing and call `router.refresh()`
  on completion, so the server component re-fetches and the AI-derived
  scores just appear. Because that background job is fire-and-forget, the
  results page's very first render can land before the `pending` analysis
  row is even committed — it treats "front photo present, no analysis row
  yet" the same as `pending` rather than rendering a blank page (see the
  comment above `aiInFlight` in `app/(app)/scans/[scanId]/page.tsx`). At
  higher volume, swap the `waitUntil` trigger for a Cloudflare Queue
  consumer — the persistence functions in `db/queries/skin-analysis.ts`
  don't need to change, only what calls them.
- **"Current vs improved" is a data projection, not a synthesized photo.**
  The results page's before/after visualization
  (`components/app/score-projection.tsx`) compares each measured score
  against a realistic near-term target computed in
  `insights.ts#getProjectedScores` — bigger gains for lower-scoring
  categories, capped at 100, explicitly labeled as a projection. We don't
  generate a fake "improved" image of someone's actual face: there's no
  reliable way to do that from a single selfie, and a fabricated result
  would undercut the trust this page is supposed to build.
- **We write the routine; the user doesn't.** Men overwhelmingly don't
  assemble a skincare routine from a list of recommendations, so
  `lib/daily-routine.ts#buildDailyRoutines` turns the same
  `CategoryPriority[]` the dashboard already computes (plus the raw YouCam
  concern scores) into two ordered, runnable sequences — a morning routine
  and an evening one — each step carrying the instruction (`how`), the score
  that put it there (`why`), and its own cadence (`frequency`). Rules-based,
  not an LLM call: entirely deterministic from scores that are already
  computed, which keeps it fast, free, and testable without a live YouCam
  key.
  - **Scores decide what's in the plan; chemistry decides the order.**
    Cleanse first, thinnest to thickest, SPF last in the morning, retinoid
    at night only and never in the same routine as vitamin C. Nothing
    re-sorts by severity — the sequence is the part a user can't be expected
    to get right themselves, which is the whole reason we generate it.
    Severity instead controls which steps appear at all (an "excellent"
    firmness score drops the retinoid step), how hard each is pushed
    (`RETINOID_SCHEDULE` ramps 2 → 3 nights by level), and the wording of
    `why` (`critical` reads urgent, `excellent` reads maintenance).
  - **One "Start here" flag per plan, and only when something is actually
    behind.** It lands on the day's *first* step for the worst-scoring
    category — moisture appears both morning and night, and two flags read
    the same as none. A scan where every category is strong gets no flag at
    all rather than a fake one.
  - **Product picks only attach to steps scoring `critical` or
    `needs_work`** (`productsFor`). Recommending a moisturizer to someone
    whose moisture is already excellent is how a plan stops reading like
    advice and starts reading like a catalog.
  - **Saving is one tap, and re-planning preserves the streak.**
    `saveGeneratedRoutinesAction` rebuilds the plan server-side from the scan
    id — the client never sends the steps — and `saveGeneratedRoutines`
    updates the existing `source = 'generated'` routine rows in place,
    replacing only their steps. Creating fresh routines on each re-plan would
    be simpler but would silently reset the streak on every check-in, which
    is the one number the whole habit loop runs on.
- **Product recommendations are a hand-curated catalog (`lib/products.ts`),
  not a live affiliate feed.** One budget + one premium pick per concern,
  each with its own one-line rationale, mirroring the "managed by hand for
  v1 — no admin UI yet" approach already used for `partnerLinks`. Affiliate
  URLs are Amazon search-results links (`?k=<query>&tag=glowforge-20`)
  rather than specific `/dp/ASIN` links, which go stale or point at the
  wrong variant — the placeholder `glowforge-20` tag needs to become a real
  Associates (or other affiliate network) id before this earns anything.
  Clicks fire `PRODUCT_LINK_CLICKED` via the same PostHog `track()` helper
  `PartnerTeaser` uses. The results page carries an explicit affiliate
  disclosure line next to any step with product picks — required for
  trust and standard FTC practice, not just decoration.
- **AI results overwrite, not append.** `metric_scores` and
  `skin_concern_scores` both have a unique index on `(scanId, metricType)` /
  `(scanId, concern)`. A completed analysis upserts into the same rows a
  manual check-in created — `source` flips from `manual_entry` to
  `ai_analysis` — rather than creating a second, conflicting set of scores
  per scan.
- **YouCam's raw concerns (≈12: wrinkle, pore, acne, moisture, firmness,
  eye_bag, dark_circle, age_spot, radiance, redness, oiliness, texture,
  droopy_eyelid) are mapped onto the 4 tracked metrics with a weighted
  average** — see the comment above `METRIC_CONCERN_WEIGHTS` in
  `lib/youcam/transform.ts` for the reasoning per metric. The mapping
  renormalizes over whichever concerns are actually present in a given
  response, so a missing field (e.g. `droopy_eyelid`, which needs an
  HD-quality photo) degrades gracefully instead of under-scoring. Concerns
  outside the 4 tracked metrics are still stored in `skin_concern_scores`
  for a future technical detail view.
- **YouCam's wire format is best-effort, not verified against a live
  account.** Perfect Corp doesn't publish a machine-readable schema and
  their own doc snapshots disagree on response envelope shape — see the
  comment block in `lib/youcam/types.ts`. `parseTaskResult` tries a few
  known shapes and degrades to an empty concern list rather than throwing.
  The full raw vendor response is stored in `skin_analyses.raw_result`
  specifically so a parsing fix can be replayed against real payloads
  without re-calling the API (results only live ~24h on YouCam's side).
  Get a sandbox key and diff one real response against `types.ts` before
  relying on this in production.
