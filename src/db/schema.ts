import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = (name = "id") =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Users — mirrors Clerk. Primary key is the Clerk user id, kept in sync via
// the /api/webhooks/clerk handler. This table is the source of truth for
// everything Clerk doesn't own: plan/billing state and referral identity.
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk user id (user_xxx)
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),

    plan: text("plan", { enum: ["free", "pro"] })
      .notNull()
      .default("free"),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),
    stripeCurrentPeriodEnd: integer("stripe_current_period_end", {
      mode: "timestamp",
    }),

    referralCode: text("referral_code").notNull().unique(),
    referredByCode: text("referred_by_code"),

    ...timestamps,
  },
  (t) => [
    index("users_stripe_customer_idx").on(t.stripeCustomerId),
    index("users_referred_by_idx").on(t.referredByCode),
  ],
);

// ---------------------------------------------------------------------------
// Scans — a single check-in session. Photos + derived metric scores hang off
// of it. One scan = one point in time on the trend charts.
// ---------------------------------------------------------------------------
export const scans = sqliteTable(
  "scans",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capturedAt: integer("captured_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("scans_user_captured_idx").on(t.userId, t.capturedAt),
  ],
);

export const scanPhotos = sqliteTable(
  "scan_photos",
  {
    id: id(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    angle: text("angle", {
      enum: ["front", "left", "right", "eyes_close"],
    }).notNull(),
    r2Key: text("r2_key").notNull(),
    ...timestamps,
  },
  (t) => [index("scan_photos_scan_idx").on(t.scanId)],
);

// Every scan produces one row per metric type, including a computed
// "overall" — keeps trend-chart queries uniform (filter by metricType only).
// Unique on (scanId, metricType): a manual check-in seeds these rows, and a
// completed AI analysis overwrites them in place (upsert) rather than
// appending a second set — one scan has one score per metric, period.
export const metricScores = sqliteTable(
  "metric_scores",
  {
    id: id(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metricType: text("metric_type", {
      enum: ["sun_damage", "firmness", "eye_area", "moisture", "overall"],
    }).notNull(),
    score: integer("score").notNull(), // 0-100, higher is better
    source: text("source", { enum: ["ai_analysis", "manual_entry"] })
      .notNull()
      .default("manual_entry"),
    ...timestamps,
  },
  (t) => [
    index("metric_scores_user_type_idx").on(t.userId, t.metricType, t.createdAt),
    index("metric_scores_scan_idx").on(t.scanId),
    uniqueIndex("metric_scores_scan_metric_unique_idx").on(t.scanId, t.metricType),
  ],
);

// ---------------------------------------------------------------------------
// Skin analyses — one per scan, tracking a YouCam (Perfect Corp) AI Skin
// Analysis job end to end: pending → processing → succeeded/failed. `status`
// uses our own vocabulary rather than the vendor's ("running"/"success"/
// "error") so a future second provider doesn't leak vendor terms into the
// domain model. `rawResult` keeps the full vendor JSON — YouCam only
// retains results for ~24h, and re-deriving concern/metric mappings after a
// scoring-weight change requires the original payload, not just what we
// extracted from it the first time.
// ---------------------------------------------------------------------------
export const skinAnalyses = sqliteTable(
  "skin_analyses",
  {
    id: id(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["youcam"] })
      .notNull()
      .default("youcam"),
    status: text("status", {
      enum: ["pending", "processing", "succeeded", "failed"],
    })
      .notNull()
      .default("pending"),
    providerFileId: text("provider_file_id"),
    providerTaskId: text("provider_task_id"),
    skinAge: integer("skin_age"),
    providerOverallScore: integer("provider_overall_score"),
    rawResult: text("raw_result"), // JSON string — full vendor task response
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("skin_analyses_scan_unique_idx").on(t.scanId),
    index("skin_analyses_user_status_idx").on(t.userId, t.status),
  ],
);

// Raw per-concern scores from the vendor (wrinkle, pore, acne, ...) — kept
// alongside the curated `metricScores` rollup so the app can show a
// technical detail view without re-fetching from YouCam (whose result
// retention window is short).
export const skinConcernScores = sqliteTable(
  "skin_concern_scores",
  {
    id: id(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => skinAnalyses.id, { onDelete: "cascade" }),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    concern: text("concern", {
      enum: [
        "wrinkle",
        "firmness",
        "acne",
        "moisture",
        "eye_bag",
        "dark_circle_v2",
        "age_spot",
        "radiance",
        "redness",
        "oiliness",
        "pore",
        "texture",
        "droopy_upper_eyelid",
        "droopy_lower_eyelid",
      ],
    }).notNull(),
    rawScore: integer("raw_score").notNull(), // 1-100 vendor raw_score, higher = healthier
    uiScore: integer("ui_score").notNull(), // 1-100 vendor ui_score (favorably adjusted)
    maskUrl: text("mask_url"), // R2 key of the heatmap overlay image, if one was captured — see persistConcernMasks
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("skin_concern_scores_user_concern_idx").on(t.userId, t.concern, t.createdAt),
    index("skin_concern_scores_analysis_idx").on(t.analysisId),
    uniqueIndex("skin_concern_scores_scan_concern_unique_idx").on(t.scanId, t.concern),
  ],
);

// ---------------------------------------------------------------------------
// Skin simulations — the goal image. One per scan, produced by chaining the
// completed analysis into YouCam's AI Skin Simulation: the measured concern
// scores pick the per-concern intensities (see `@/lib/face-simulation`), and
// the vendor renders those onto the user's own front photo.
//
// `params` stores the exact intensities that were sent, as JSON. That's not
// debug residue — the UI shows the user which concerns the image is claiming
// to change, and a stored payload is the only way that caption can't drift
// from the picture. It also makes a tuning change auditable after the fact:
// "why does my August image look stronger than my July one" has an answer.
//
// `r2Key` mirrors the vendor's output, whose presigned URL dies after 2 hours
// — the same reason `persistConcernMasks` exists for masks.
// ---------------------------------------------------------------------------
export const skinSimulations = sqliteTable(
  "skin_simulations",
  {
    id: id(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["youcam"] })
      .notNull()
      .default("youcam"),
    status: text("status", {
      enum: ["pending", "processing", "succeeded", "failed", "skipped"],
    })
      .notNull()
      .default("pending"),
    // What the image is aiming at — a tracked metric, or "overall". Stored so
    // the caption matches the picture even after the user's priorities shift.
    goalFocus: text("goal_focus", {
      enum: ["sun_damage", "firmness", "eye_area", "moisture", "overall"],
    })
      .notNull()
      .default("overall"),
    goalHorizonWeeks: integer("goal_horizon_weeks").notNull().default(12),
    params: text("params"), // JSON — { wrinkle: 0.3, spots: 0.2, ... } as sent
    providerFileId: text("provider_file_id"),
    providerTaskId: text("provider_task_id"),
    r2Key: text("r2_key"), // mirrored result image
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("skin_simulations_scan_unique_idx").on(t.scanId),
    index("skin_simulations_user_status_idx").on(t.userId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Skin predictions — closes the loop. One per scan: the goal image from
// `skinSimulations` is fed back through the same YouCam skin-analysis
// endpoint used on real photos, so the vendor's own analysis grades its own
// generation. Deliberately its own table, never `skinAnalyses` — that table
// (and `getFaceAgeReadings`, which powers the real face-age mission number)
// has no discriminator column and assumes every row came from a real photo.
// A predicted result living anywhere near it risks corrupting or impersonating
// real face-age history; this table can only ever be read where it's asked
// for by name.
// ---------------------------------------------------------------------------
export const skinPredictions = sqliteTable(
  "skin_predictions",
  {
    id: id(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["youcam"] })
      .notNull()
      .default("youcam"),
    status: text("status", {
      enum: ["pending", "processing", "succeeded", "failed", "skipped"],
    })
      .notNull()
      .default("pending"),
    predictedSkinAge: integer("predicted_skin_age"),
    predictedOverallScore: integer("predicted_overall_score"),
    providerFileId: text("provider_file_id"),
    providerTaskId: text("provider_task_id"),
    rawResult: text("raw_result"), // JSON string — full vendor task response
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("skin_predictions_scan_unique_idx").on(t.scanId),
    index("skin_predictions_user_status_idx").on(t.userId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Routines — the fitness-tracker-style habit loop. Steps are the plan,
// completions are the log entries streaks are computed from.
// ---------------------------------------------------------------------------
export const routines = sqliteTable(
  "routines",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timeOfDay: text("time_of_day", { enum: ["am", "pm", "both"] })
      .notNull()
      .default("both"),
    // Who wrote this routine. `generated` rows are the AM/PM plan we build
    // from a scan — we rewrite their *steps* in place on every regeneration
    // rather than creating new routines, so the completion history (and
    // therefore the streak) survives a re-plan. There is at most one
    // generated routine per user per slot; see `saveGeneratedRoutines`.
    source: text("source", { enum: ["manual", "generated"] })
      .notNull()
      .default("manual"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (t) => [index("routines_user_idx").on(t.userId)],
);

export const routineSteps = sqliteTable(
  "routine_steps",
  {
    id: id(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull().default(0),
    productName: text("product_name").notNull(),
    category: text("category", {
      enum: [
        "cleanser",
        "sunscreen",
        "retinoid",
        "moisturizer",
        "treatment",
        "shaving",
        "other",
      ],
    })
      .notNull()
      .default("other"),
    ...timestamps,
  },
  (t) => [index("routine_steps_routine_idx").on(t.routineId)],
);

// One row per user per routine per calendar day — the unique index is what
// makes "log today" idempotent and streak math a simple date-diff query.
export const routineCompletions = sqliteTable(
  "routine_completions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    completedDate: text("completed_date").notNull(), // YYYY-MM-DD, local to user
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routine_completions_unique_day_idx").on(
      t.userId,
      t.routineId,
      t.completedDate,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Face Gym — one row per finished workout, written when the last round's
// clock runs out. Unlike routines this is deliberately *not* one row per
// day: two sessions in a day is the behaviour we most want to see, and
// collapsing them to a tick would hide it. Idempotency comes from `id`
// instead, which the player mints when the session starts — see
// `logFaceGymSession`.
// ---------------------------------------------------------------------------
export const faceGymSessions = sqliteTable(
  "face_gym_sessions",
  {
    id: text("id").primaryKey(), // client-minted per session run
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completedDate: text("completed_date").notNull(), // YYYY-MM-DD, the grain streaks are computed on
    // Rounds whose minute actually ran out, out of the rounds on offer.
    // Skipping to the end still finishes a session — it just doesn't earn
    // the same row, and the coach copy is allowed to notice.
    roundsCompleted: integer("rounds_completed").notNull(),
    roundsTotal: integer("rounds_total").notNull(),
    // Time with the clock running, so a session left paused on a desk
    // doesn't read as an hour of work.
    activeSeconds: integer("active_seconds").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    ...timestamps,
  },
  (t) => [
    index("face_gym_sessions_user_date_idx").on(t.userId, t.completedDate),
    index("face_gym_sessions_user_completed_idx").on(t.userId, t.completedAt),
  ],
);

// ---------------------------------------------------------------------------
// Shares — public, unauthenticated result cards. This is the viral loop:
// anyone with the slug can view a read-only progress card at /s/[slug].
// ---------------------------------------------------------------------------
export const shares = sqliteTable(
  "shares",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["single_scan", "progress_comparison"],
    }).notNull(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    compareScanId: text("compare_scan_id").references(() => scans.id, {
      onDelete: "set null",
    }),
    isPublic: integer("is_public", { mode: "boolean" })
      .notNull()
      .default(true),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("shares_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Revenue: affiliate + sponsor placements shown in-app (results page,
// routine suggestions). Managed by hand for v1 — no admin UI yet.
// ---------------------------------------------------------------------------
export const partnerLinks = sqliteTable("partner_links", {
  id: id(),
  slug: text("slug").notNull().unique(),
  kind: text("kind", { enum: ["affiliate", "sponsor"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetUrl: text("target_url").notNull(),
  imageUrl: text("image_url"),
  /**
   * The concern this placement answers — one of the four tracked metrics or
   * `radiance`, matching `PrimeMoveMetric` in `lib/prime-move.ts`. Set it and
   * the link becomes eligible as the partner pick on the single
   * recommendation for that concern; leave it null and the link stays a
   * general placement, which is what every pre-existing row is. Untyped on
   * purpose — it's hand-managed data, and a D1 CHECK constraint here would
   * mean a migration every time the metric list moves.
   */
  metric: text("metric"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  /**
   * Promotes a row onto the signed-in home's promotions panel. Deliberately
   * separate from `isActive` — every partner link on this table is a
   * candidate for the quiet affiliate teaser at the foot of the dashboard,
   * but the panel is prominent, image-led real estate right under the
   * mission, and belongs to a small hand-picked set rather than growing with
   * every row added here.
   */
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Webhook idempotency — Stripe and Clerk both retry on non-2xx and can
// redeliver already-processed events. One shared log for both sources.
// ---------------------------------------------------------------------------
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(), // provider's event id — natural idempotency key
  source: text("source", { enum: ["stripe", "clerk"] }).notNull(),
  type: text("type").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Relations — required by drizzle's relational query API (`db.query.x.find*`
// with a `with:` clause). FK `.references()` alone only affects SQL DDL, not
// query-builder joins.
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  scans: many(scans),
  routines: many(routines),
  shares: many(shares),
  faceGymSessions: many(faceGymSessions),
}));

export const faceGymSessionsRelations = relations(faceGymSessions, ({ one }) => ({
  user: one(users, { fields: [faceGymSessions.userId], references: [users.id] }),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  user: one(users, { fields: [scans.userId], references: [users.id] }),
  photos: many(scanPhotos),
  metricScores: many(metricScores),
  analysis: one(skinAnalyses),
  simulation: one(skinSimulations),
  prediction: one(skinPredictions),
}));

export const skinSimulationsRelations = relations(skinSimulations, ({ one }) => ({
  scan: one(scans, { fields: [skinSimulations.scanId], references: [scans.id] }),
  user: one(users, { fields: [skinSimulations.userId], references: [users.id] }),
}));

export const skinPredictionsRelations = relations(skinPredictions, ({ one }) => ({
  scan: one(scans, { fields: [skinPredictions.scanId], references: [scans.id] }),
  user: one(users, { fields: [skinPredictions.userId], references: [users.id] }),
}));

export const scanPhotosRelations = relations(scanPhotos, ({ one }) => ({
  scan: one(scans, { fields: [scanPhotos.scanId], references: [scans.id] }),
}));

export const metricScoresRelations = relations(metricScores, ({ one }) => ({
  scan: one(scans, { fields: [metricScores.scanId], references: [scans.id] }),
}));

export const skinAnalysesRelations = relations(skinAnalyses, ({ one, many }) => ({
  scan: one(scans, { fields: [skinAnalyses.scanId], references: [scans.id] }),
  user: one(users, { fields: [skinAnalyses.userId], references: [users.id] }),
  concernScores: many(skinConcernScores),
}));

export const skinConcernScoresRelations = relations(skinConcernScores, ({ one }) => ({
  analysis: one(skinAnalyses, {
    fields: [skinConcernScores.analysisId],
    references: [skinAnalyses.id],
  }),
  scan: one(scans, { fields: [skinConcernScores.scanId], references: [scans.id] }),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, { fields: [routines.userId], references: [users.id] }),
  steps: many(routineSteps),
  completions: many(routineCompletions),
}));

export const routineStepsRelations = relations(routineSteps, ({ one }) => ({
  routine: one(routines, {
    fields: [routineSteps.routineId],
    references: [routines.id],
  }),
}));

export const routineCompletionsRelations = relations(routineCompletions, ({ one }) => ({
  routine: one(routines, {
    fields: [routineCompletions.routineId],
    references: [routines.id],
  }),
}));

export const sharesRelations = relations(shares, ({ one }) => ({
  user: one(users, { fields: [shares.userId], references: [users.id] }),
  scan: one(scans, { fields: [shares.scanId], references: [scans.id] }),
  compareScan: one(scans, {
    fields: [shares.compareScanId],
    references: [scans.id],
  }),
}));
