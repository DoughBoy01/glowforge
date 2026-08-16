/**
 * Event taxonomy. Keep names here so client (posthog-js) and server
 * (posthog-node) capture calls can't drift into inconsistent naming.
 */
export const ANALYTICS_EVENTS = {
  // Core loop
  CHECK_IN_STARTED: "check_in_started",
  CHECK_IN_COMPLETED: "check_in_completed",
  ROUTINE_GENERATED: "routine_generated",
  ROUTINE_STEP_LOGGED: "routine_step_logged",
  STREAK_MILESTONE_HIT: "streak_milestone_hit",

  // Face Gym
  FACE_GYM_SESSION_STARTED: "face_gym_session_started",
  FACE_GYM_SESSION_COMPLETED: "face_gym_session_completed",

  // AI skin analysis (YouCam)
  AI_ANALYSIS_REQUESTED: "ai_analysis_requested",
  AI_ANALYSIS_COMPLETED: "ai_analysis_completed",
  AI_ANALYSIS_FAILED: "ai_analysis_failed",
  GOAL_SIMULATION_COMPLETED: "goal_simulation_completed",
  GOAL_SIMULATION_FAILED: "goal_simulation_failed",
  // Closing the loop: re-analyzing the goal image to grade it against the
  // vendor's own measurement.
  PREDICTION_COMPLETED: "prediction_completed",
  PREDICTION_FAILED: "prediction_failed",

  // Viral loop
  SHARE_CARD_CREATED: "share_card_created",
  SHARE_CARD_VIEWED: "share_card_viewed",
  REFERRAL_SIGNUP: "referral_signup",

  // Revenue
  CHECKOUT_STARTED: "checkout_started",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  BILLING_PORTAL_OPENED: "billing_portal_opened",
  PARTNER_LINK_CLICKED: "partner_link_clicked",
  PRODUCT_LINK_CLICKED: "product_link_clicked",
  PROMOTION_CLICKED: "promotion_clicked",
  // Opening the curated shortlist on the single recommendation. The card is
  // built to be actionable without it, so this measures how many men want a
  // pick made for them versus a spec to shop against themselves.
  PRIME_MOVE_OPTIONS_OPENED: "prime_move_options_opened",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
