const supabase = require("./db");

const CAMPAIGN_KEY = "marketing-launch-10-day";
const MISSING_RELATION_CODES = new Set(["42P01", "PGRST205"]);

function isMissingCampaignSchema(error) {
  return Boolean(error && (MISSING_RELATION_CODES.has(error.code) || /campaign_(settings|trials|review_requests)/i.test(String(error.message || ""))));
}

async function findCampaignByCourse(courseId) {
  const { data, error } = await supabase
    .from("campaign_settings")
    .select("*")
    .eq("course_id", courseId)
    .eq("campaign_key", CAMPAIGN_KEY)
    .maybeSingle();
  if (error) {
    if (isMissingCampaignSchema(error)) return null;
    throw error;
  }
  return data || null;
}

async function findCampaignByKey(campaignKey = CAMPAIGN_KEY) {
  const { data, error } = await supabase
    .from("campaign_settings")
    .select("*")
    .eq("campaign_key", campaignKey)
    .maybeSingle();
  if (error) {
    if (isMissingCampaignSchema(error)) return null;
    throw error;
  }
  return data || null;
}

async function findCampaignTrial(userId, courseId) {
  const { data, error } = await supabase
    .from("campaign_trials")
    .select("id, campaign_key, user_id, course_id, payment_id, duration_days, status, started_at, expires_at, created_at, updated_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("campaign_key", CAMPAIGN_KEY)
    .maybeSingle();
  if (error) {
    if (isMissingCampaignSchema(error)) return null;
    throw error;
  }
  return data || null;
}

function secondsRemaining(expiresAt, now = Date.now()) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

function campaignTrialStatus(trial, now = Date.now()) {
  if (!trial) {
    return { started: false, active: false, remainingSeconds: 0, kind: "campaign" };
  }
  const remainingSeconds = trial.status === "active" ? secondsRemaining(trial.expires_at, now) : 0;
  return {
    id: trial.id,
    started: true,
    active: remainingSeconds > 0,
    remainingSeconds,
    kind: "campaign",
    campaignKey: trial.campaign_key,
    paymentId: trial.payment_id,
    durationDays: Number(trial.duration_days || 0),
    status: trial.status,
    startedAt: trial.started_at,
    expiresAt: trial.expires_at,
  };
}

function publicCampaignSettings(setting, course) {
  if (!setting) return null;
  return {
    key: setting.campaign_key,
    enabled: Boolean(setting.enabled),
    courseId: setting.course_id,
    courseSlug: course?.slug || null,
    priceCents: Number(setting.price_cents),
    currency: setting.currency || course?.currency || "EGP",
    durationDays: Number(setting.duration_days),
    normalPriceCents: Number(setting.normal_price_cents),
    normalTrialMinutes: Number(setting.normal_trial_minutes),
    reviewEnabled: Boolean(setting.review_enabled),
  };
}

function adminCampaignSettings(setting, course) {
  if (!setting) return null;
  return {
    ...publicCampaignSettings(setting, course),
    goalSubscribers: Number(setting.goal_subscribers),
    goalReviews: Number(setting.goal_reviews),
    reviewMinDays: Number(setting.review_min_days),
    reviewMinProgress: Number(setting.review_min_progress),
    reviewMinCompletedLessons: Number(setting.review_min_completed_lessons),
    reviewsRequireModeration: Boolean(setting.reviews_require_moderation),
    createdAt: setting.created_at,
    updatedAt: setting.updated_at,
  };
}

function campaignExpiry(startedAt, durationDays) {
  const start = new Date(startedAt);
  const days = Number(durationDays);
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(days) || days <= 0) return null;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

module.exports = {
  CAMPAIGN_KEY,
  isMissingCampaignSchema,
  findCampaignByCourse,
  findCampaignByKey,
  findCampaignTrial,
  campaignTrialStatus,
  publicCampaignSettings,
  adminCampaignSettings,
  campaignExpiry,
};
