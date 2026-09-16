const express = require("express");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { rateLimit } = require("../middleware/rate-limit");
const {
  CAMPAIGN_KEY,
  findCampaignByCourse,
  findCampaignTrial,
  campaignTrialStatus,
  publicCampaignSettings,
  adminCampaignSettings,
} = require("../campaign-service");

const router = express.Router();
const campaignStatusLimiter = rateLimit({ name: "campaign-status", windowMs: 60 * 1000, max: 60, keyGenerator: (req) => String(req.userId || req.ip || "unknown") });

function numericId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function findCourse(identifier) {
  let query = supabase.from("courses").select("id, slug, title, currency, price_cents, trial_minutes, status");
  query = /^\d+$/.test(String(identifier || "")) ? query.eq("id", Number(identifier)) : query.eq("slug", String(identifier));
  const { data, error } = await query.eq("status", "published").maybeSingle();
  if (error) throw error;
  return data || null;
}

function publicStatus(setting, trial, course) {
  return {
    key: setting?.campaign_key || CAMPAIGN_KEY,
    course: course ? { id: course.id, slug: course.slug, title: course.title } : null,
    campaign: publicCampaignSettings(setting, course),
    trial: campaignTrialStatus(trial),
  };
}

router.get("/:courseId", campaignStatusLimiter, async (req, res) => {
  try {
    const course = await findCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const setting = await findCampaignByCourse(course.id);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, ...publicStatus(setting, null, course) });
  } catch (error) {
    console.error("Public campaign status error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل إعدادات الحملة حاليًا." });
  }
});

router.get("/:courseId/mine", requireAuth, campaignStatusLimiter, async (req, res) => {
  try {
    const course = await findCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const setting = await findCampaignByCourse(course.id);
    const trial = setting ? await findCampaignTrial(req.userId, course.id) : null;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, ...publicStatus(setting, trial, course) });
  } catch (error) {
    console.error("My campaign status error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل حالة الحملة حاليًا." });
  }
});

router.get("/admin/:courseId", requireAdmin, async (req, res) => {
  try {
    const courseId = numericId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: "معرف الكورس غير صالح." });
    const { data: course, error: courseError } = await supabase.from("courses").select("id, slug, title, currency, price_cents, trial_minutes").eq("id", courseId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const setting = await findCampaignByCourse(course.id);
    if (!setting) return res.json({ ok: true, settings: null, stats: null });

    const now = new Date().toISOString();
    const [trialsResult, activeResult, expiredResult, paidResult, reviewsResult, publishedReviewsResult, pendingReviewsResult] = await Promise.all([
      supabase.from("campaign_trials").select("id", { count: "exact", head: true }).eq("campaign_key", setting.campaign_key),
      supabase.from("campaign_trials").select("id", { count: "exact", head: true }).eq("campaign_key", setting.campaign_key).eq("status", "active").gt("expires_at", now),
      supabase.from("campaign_trials").select("id", { count: "exact", head: true }).eq("campaign_key", setting.campaign_key).or(`status.eq.expired,expires_at.lte.${now}`),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("payment_type", "campaign_trial").eq("status", "paid"),
      supabase.from("course_reviews").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("campaign_key", setting.campaign_key),
      supabase.from("course_reviews").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("campaign_key", setting.campaign_key).eq("status", "published"),
      supabase.from("course_reviews").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("campaign_key", setting.campaign_key).eq("status", "pending"),
    ]);
    const firstError = [trialsResult, activeResult, expiredResult, paidResult, reviewsResult, publishedReviewsResult, pendingReviewsResult].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    res.set("Cache-Control", "private, no-store");
    res.json({
      ok: true,
      settings: adminCampaignSettings(setting, course),
      stats: {
        subscribers: Number(trialsResult.count || 0),
        paidPayments: Number(paidResult.count || 0),
        activeTrials: Number(activeResult.count || 0),
        expiredTrials: Number(expiredResult.count || 0),
        reviews: Number(reviewsResult.count || 0),
        publishedReviews: Number(publishedReviewsResult.count || 0),
        pendingReviews: Number(pendingReviewsResult.count || 0),
      },
    });
  } catch (error) {
    console.error("Admin campaign status error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل إحصاءات الحملة حاليًا." });
  }
});

router.get("/admin/:courseId/reviews", requireAdmin, async (req, res) => {
  try {
    const courseId = numericId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: "معرف الكورس غير صالح." });
    const setting = await findCampaignByCourse(courseId);
    if (!setting) return res.status(404).json({ ok: false, error: "إعداد حملة Marketing Launch غير موجود." });
    const status = ["pending", "published", "hidden"].includes(String(req.query.status || "")) ? String(req.query.status) : null;
    let query = supabase.from("course_reviews").select("id, user_id, course_id, rating, comment, status, verified_purchase, campaign_key, review_request_id, created_at, updated_at, users(full_name, email)").eq("course_id", courseId).eq("campaign_key", setting.campaign_key).order("created_at", { ascending: false }).limit(200);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, reviews: (data || []).map((review) => ({ id: review.id, rating: review.rating, comment: review.comment || "", status: review.status, verifiedPurchase: Boolean(review.verified_purchase), campaignKey: review.campaign_key, requestId: review.review_request_id, reviewerName: review.users?.full_name || "طالب QuadraLevel", reviewerEmail: review.users?.email || null, createdAt: review.created_at, updatedAt: review.updated_at })) });
  } catch (error) {
    console.error("Admin campaign reviews list error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل تقييمات الحملة حاليًا." });
  }
});

router.patch("/admin/reviews/:reviewId", requireAdmin, async (req, res) => {
  try {
    const reviewId = numericId(req.params.reviewId);
    const status = String(req.body?.status || "");
    if (!reviewId || !["published", "hidden"].includes(status)) return res.status(400).json({ ok: false, error: "حالة التقييم غير صالحة." });
    const { data: current, error: currentError } = await supabase.from("course_reviews").select("id, campaign_key").eq("id", reviewId).maybeSingle();
    if (currentError) throw currentError;
    if (!current || current.campaign_key !== CAMPAIGN_KEY) return res.status(404).json({ ok: false, error: "تقييم الحملة غير موجود." });
    const { data, error } = await supabase.from("course_reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", reviewId).select("id, rating, comment, status, created_at, updated_at").single();
    if (error) throw error;
    res.json({ ok: true, review: data });
  } catch (error) {
    console.error("Admin campaign review update error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحديث حالة التقييم." });
  }
});

router.patch("/admin/:courseId", requireAdmin, async (req, res) => {
  try {
    const courseId = numericId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: "معرف الكورس غير صالح." });
    const { data: current, error: currentError } = await supabase.from("campaign_settings").select("*").eq("course_id", courseId).eq("campaign_key", CAMPAIGN_KEY).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ ok: false, error: "إعداد حملة Marketing Launch غير موجود. شغّل Migration أولًا." });

    const input = req.body && typeof req.body === "object" ? req.body : {};
    const integer = (key, min, max) => {
      if (input[key] === undefined) return undefined;
      const value = Number(input[key]);
      if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key}_INVALID`);
      return value;
    };
    const decimal = (key, min, max) => {
      if (input[key] === undefined) return undefined;
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key}_INVALID`);
      return value;
    };
    const booleanValue = (key) => {
      if (input[key] === undefined) return undefined;
      if (typeof input[key] !== "boolean") throw new Error(`${key}_INVALID`);
      return input[key];
    };
    const patch = {
      updated_at: new Date().toISOString(),
    };
    const enabled = booleanValue("enabled");
    if (enabled !== undefined) patch.enabled = enabled;
    const fields = [
      ["priceCents", "price_cents", 1, 100000000],
      ["durationDays", "duration_days", 1, 365],
      ["normalPriceCents", "normal_price_cents", 0, 100000000],
      ["normalTrialMinutes", "normal_trial_minutes", 0, 1440],
      ["goalSubscribers", "goal_subscribers", 0, 100000000],
      ["goalReviews", "goal_reviews", 0, 100000000],
      ["reviewMinDays", "review_min_days", 0, 365],
      ["reviewMinCompletedLessons", "review_min_completed_lessons", 0, 100000],
    ];
    fields.forEach(([inputKey, column, min, max]) => {
      const value = integer(inputKey, min, max);
      if (value !== undefined) patch[column] = value;
    });
    const progress = decimal("reviewMinProgress", 0, 100);
    if (progress !== undefined) patch.review_min_progress = progress;
    const reviewEnabled = booleanValue("reviewEnabled");
    const moderation = booleanValue("reviewsRequireModeration");
    if (reviewEnabled !== undefined) patch.review_enabled = reviewEnabled;
    if (moderation !== undefined) patch.reviews_require_moderation = moderation;
    if (input.currency !== undefined) {
      const currency = String(input.currency || "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency_INVALID");
      patch.currency = currency;
    }

    const { data: updated, error } = await supabase.from("campaign_settings").update(patch).eq("id", current.id).select("*").single();
    if (error) throw error;
    const { data: course } = await supabase.from("courses").select("id, slug, title, currency, price_cents, trial_minutes").eq("id", courseId).maybeSingle();
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, settings: adminCampaignSettings(updated, course) });
  } catch (error) {
    if (/^([a-zA-Z]+)_INVALID$/.test(String(error.message || ""))) return res.status(400).json({ ok: false, error: "إحدى قيم إعدادات الحملة غير صالحة." });
    console.error("Admin campaign update error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ إعدادات الحملة." });
  }
});

module.exports = router;
