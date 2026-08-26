const express = require("express");
const crypto = require("crypto");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");
const { findPublishedCourse, getAccess } = require("./courses");
const { findCampaignByCourse, findCampaignTrial, campaignTrialStatus, isMissingCampaignSchema } = require("../campaign-service");

const router = express.Router();
const REVIEW_VIDEO_BUCKET = process.env.REVIEW_VIDEO_BUCKET || "review-media";
const MAX_COMMENT_LENGTH = 2000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
const VIDEO_EXTENSIONS = { "video/mp4": "mp4", "video/webm": "webm" };

const userKey = (req) => String(req.userId || req.ip || "unknown");
const reviewCreateLimiter = rateLimit({ name: "review-create", windowMs: 15 * 60 * 1000, max: 5, keyGenerator: userKey });
const reviewUploadLimiter = rateLimit({ name: "review-video-upload", windowMs: 60 * 60 * 1000, max: 3, keyGenerator: userKey });

function numericId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function publicReview(row, videoUrl) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment || "",
    verifiedPurchase: Boolean(row.verified_purchase),
    reviewerName: row.users?.full_name || "طالب QuadraLevel",
    videoUrl: videoUrl || null,
    videoMimeType: row.video_mime_type || null,
    createdAt: row.created_at,
    status: row.status,
  };
}

async function signedVideoUrl(row) {
  if (!row?.video_bucket || !row?.video_path) return null;
  const { data, error } = await supabase.storage.from(row.video_bucket).createSignedUrl(row.video_path, 60 * 60);
  if (error) {
    console.warn("Review video signed URL skipped:", error.message || error);
    return null;
  }
  return data?.signedUrl || null;
}

async function serializeReview(row) {
  return publicReview(row, await signedVideoUrl(row));
}

async function findReview(reviewId, userId) {
  let query = supabase
    .from("course_reviews")
    .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
    .eq("id", reviewId);
  if (userId !== undefined) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function reviewEligibility(userId, courseId) {
  const setting = await findCampaignByCourse(courseId);
  if (!setting) return { eligible: false, campaign: null, request: null, alreadyReviewed: false, metrics: null, requirements: null };

  const [trialResult, progressResult, lessonsResult, reviewResult, requestResult] = await Promise.all([
    findCampaignTrial(userId, courseId),
    supabase.from("course_progress").select("progress, completed").eq("user_id", userId).eq("course_id", courseId),
    supabase.from("lessons").select("id").eq("course_id", courseId),
    supabase.from("course_reviews").select("id, status").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
    supabase.from("campaign_review_requests").select("id, status, eligible_at, requested_at, submitted_at").eq("user_id", userId).eq("campaign_key", setting.campaign_key).maybeSingle(),
  ]);
  const firstError = [progressResult, lessonsResult, reviewResult, requestResult].find((result) => result.error)?.error;
  if (firstError) {
    if (isMissingCampaignSchema(firstError)) return { eligible: false, campaign: setting, request: null, alreadyReviewed: false, metrics: null, requirements: null, schemaReady: false };
    throw firstError;
  }

  const progressRows = progressResult.data || [];
  const totalLessons = (lessonsResult.data || []).length || progressRows.length;
  const completedLessons = progressRows.filter((row) => Boolean(row.completed)).length;
  const progressPct = totalLessons ? Math.round((progressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) / totalLessons) * 100) / 100 : 0;
  const elapsedDays = trialResult ? Math.max(0, Math.floor((Date.now() - new Date(trialResult.started_at).getTime()) / (24 * 60 * 60 * 1000))) : 0;
  const request = requestResult.data || null;
  const trialState = campaignTrialStatus(trialResult);
  const alreadyReviewed = Boolean(reviewResult.data);
  const requirements = {
    minDays: Number(setting.review_min_days),
    minProgress: Number(setting.review_min_progress),
    minCompletedLessons: Number(setting.review_min_completed_lessons),
  };
  const eligible = Boolean(
    setting.review_enabled &&
    trialState.active &&
    !alreadyReviewed &&
    (!request || request.status === "eligible") &&
    elapsedDays >= requirements.minDays &&
    progressPct >= requirements.minProgress &&
    completedLessons >= requirements.minCompletedLessons
  );
  return {
    eligible,
    campaign: setting,
    request,
    alreadyReviewed,
    trial: trialResult,
    metrics: { elapsedDays, progressPct, completedLessons },
    requirements,
    schemaReady: true,
  };
}

function publicReviewRequest(result) {
  return {
    eligible: Boolean(result.eligible),
    status: result.request?.status || null,
    alreadyReviewed: Boolean(result.alreadyReviewed),
    metrics: result.metrics || { elapsedDays: 0, progressPct: 0, completedLessons: 0 },
    requirements: result.requirements || null,
    campaignEnabled: Boolean(result.campaign && (result.campaign.enabled || result.trial)),
    reviewEnabled: Boolean(result.campaign?.review_enabled),
  };
}

// GET /api/reviews/:courseId/request — optional campaign review eligibility.
router.get("/:courseId/request", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const result = await reviewEligibility(req.userId, course.id);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, request: publicReviewRequest(result) });
  } catch (error) {
    console.error("Review request eligibility error:", error);
    res.status(500).json({ ok: false, error: "تعذر التحقق من أهلية التقييم حاليًا." });
  }
});

// POST /api/reviews/:courseId/request — user-initiated, optional review request.
router.post("/:courseId/request", requireAuth, reviewCreateLimiter, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const result = await reviewEligibility(req.userId, course.id);
    if (!result.campaign || !result.schemaReady) return res.status(409).json({ ok: false, error: "طلب تقييم الحملة غير متاح حاليًا." });
    if (result.request?.status === "requested") return res.json({ ok: true, request: { ...publicReviewRequest(result), status: "requested", alreadyRequested: true } });
    if (result.request?.status === "submitted") return res.json({ ok: true, request: { ...publicReviewRequest(result), status: "submitted", alreadyRequested: true } });
    if (!result.eligible) return res.status(409).json({ ok: false, error: "سيظهر طلب التقييم بعد استخدام الكورس وتحقيق شروط الأهلية المحددة." });

    const { data, error } = await supabase.from("campaign_review_requests").insert({
      campaign_key: result.campaign.campaign_key,
      user_id: req.userId,
      course_id: course.id,
      campaign_trial_id: result.trial.id,
      status: "requested",
      eligible_at: new Date(new Date(result.trial.started_at).getTime() + result.requirements.minDays * 24 * 60 * 60 * 1000).toISOString(),
      requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select("id, status, eligible_at, requested_at, submitted_at").single();
    if (error) {
      if (error.code === "23505") return res.json({ ok: true, request: { ...publicReviewRequest(result), status: "requested", alreadyRequested: true } });
      throw error;
    }
    res.status(201).json({ ok: true, request: { ...publicReviewRequest(result), status: data.status, alreadyRequested: true } });
  } catch (error) {
    console.error("Create review request error:", error);
    res.status(500).json({ ok: false, error: "تعذر تسجيل طلب التقييم حاليًا." });
  }
});

// GET /api/reviews/:courseId/mine — current user's own review, if any.
router.get("/:courseId/mine", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });

    const { data, error } = await supabase
      .from("course_reviews")
      .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
      .eq("course_id", course.id)
      .eq("user_id", req.userId)
      .maybeSingle();
    if (error) throw error;

    res.json({ ok: true, review: data ? await serializeReview(data) : null });
  } catch (error) {
    console.error("My review error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل تقييمك حاليًا." });
  }
});

// GET /api/reviews/:courseId — public published reviews and aggregate summary.
router.get("/:courseId", async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });

    const { data, error } = await supabase
      .from("course_reviews")
      .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
      .eq("course_id", course.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const rows = data || [];
    const reviews = await Promise.all(rows.map(serializeReview));
    const total = rows.length;
    const average = total ? Math.round((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / total) * 100) / 100 : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach((row) => { distribution[row.rating] = (distribution[row.rating] || 0) + 1; });

    res.json({ ok: true, summary: { average, total, distribution }, reviews });
  } catch (error) {
    console.error("Public reviews error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل التقييمات حاليًا." });
  }
});

// POST /api/reviews/:courseId — one review per user/course, available with course access.
router.post("/:courseId", requireAuth, reviewCreateLimiter, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "افتح الكورس أو اشترِه أولًا حتى تتمكن من تقييمه." });

    const campaign = await findCampaignByCourse(course.id);
    const campaignTrial = campaign ? await findCampaignTrial(req.userId, course.id) : null;
    let campaignRequest = null;
    if (campaignTrial && campaign) {
      const { data, error } = await supabase.from("campaign_review_requests").select("id, status").eq("user_id", req.userId).eq("course_id", course.id).eq("campaign_key", campaign.campaign_key).maybeSingle();
      if (error) throw error;
      campaignRequest = data;
      if (!campaignRequest || campaignRequest.status !== "requested") return res.status(409).json({ ok: false, error: "اطلب التقييم اختياريًا أولًا بعد تحقيق شروط الاستخدام." });
    }

    const input = req.body && typeof req.body === "object" ? req.body : {};
    const rating = Number(input.rating);
    const comment = String(input.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: "اختر تقييمًا من نجمة إلى 5 نجوم." });
    if (comment.length > MAX_COMMENT_LENGTH) return res.status(400).json({ ok: false, error: "التعليق طويل جدًا. الحد الأقصى 2000 حرف." });

    const { data: existing, error: existingError } = await supabase
      .from("course_reviews")
      .select("id")
      .eq("user_id", req.userId)
      .eq("course_id", course.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.status(409).json({ ok: false, error: "لديك تقييم سابق لهذا الكورس." });

    const reviewStatus = campaignTrial && campaign?.reviews_require_moderation ? "pending" : "published";
    const { data, error } = await supabase
      .from("course_reviews")
      .insert({
        user_id: req.userId,
        course_id: course.id,
        rating,
        comment,
        status: reviewStatus,
        verified_purchase: access.enrolled,
        campaign_key: campaignTrial ? campaign.campaign_key : null,
        review_request_id: campaignRequest?.id || null,
      })
      .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
      .single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "لديك تقييم سابق لهذا الكورس." });
      throw error;
    }

    if (campaignRequest?.id) {
      await supabase.from("campaign_review_requests").update({ status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaignRequest.id);
    }
    res.status(201).json({ ok: true, review: await serializeReview(data), moderation: reviewStatus === "pending" ? "pending" : "published" });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ التقييم حاليًا." });
  }
});

// POST /api/reviews/:reviewId/video — upload one short MP4/WebM video for the review owner.
router.post(
  "/:reviewId/video",
  requireAuth,
  reviewUploadLimiter,
  express.raw({ type: ["video/mp4", "video/webm"], limit: MAX_VIDEO_BYTES }),
  async (req, res) => {
    try {
      const reviewId = numericId(req.params.reviewId);
      if (!reviewId || !Buffer.isBuffer(req.body) || req.body.length < 1) return res.status(400).json({ ok: false, error: "ملف الفيديو غير صالح." });
      if (req.body.length > MAX_VIDEO_BYTES) return res.status(413).json({ ok: false, error: "حجم الفيديو يجب ألا يتجاوز 50MB." });

      const contentType = String(req.headers["content-type"] || "").split(";", 1)[0].toLowerCase();
      if (!VIDEO_MIME_TYPES.has(contentType)) return res.status(415).json({ ok: false, error: "صيغة الفيديو المسموحة هي MP4 أو WebM فقط." });

      const review = await findReview(reviewId, req.userId);
      if (!review) return res.status(404).json({ ok: false, error: "التقييم غير موجود أو لا تملك صلاحية تعديله." });
      const course = await findPublishedCourse(review.course_id);
      if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });

      const extension = VIDEO_EXTENSIONS[contentType];
      const videoPath = `${course.id}/${req.userId}/${review.id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(REVIEW_VIDEO_BUCKET).upload(videoPath, req.body, {
        contentType,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("course_reviews")
        .update({
          video_bucket: REVIEW_VIDEO_BUCKET,
          video_path: videoPath,
          video_mime_type: contentType,
          video_size_bytes: req.body.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", review.id)
        .eq("user_id", req.userId)
        .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
        .single();
      if (error) throw error;

      res.json({ ok: true, review: await serializeReview(data) });
    } catch (error) {
      console.error("Review video upload error:", error);
      res.status(500).json({ ok: false, error: "تعذر رفع فيديو التقييم حاليًا." });
    }
  }
);

module.exports = router;
