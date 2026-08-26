const express = require("express");
const crypto = require("crypto");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");
const { findPublishedCourse, getAccess } = require("./courses");

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

    const { data, error } = await supabase
      .from("course_reviews")
      .insert({
        user_id: req.userId,
        course_id: course.id,
        rating,
        comment,
        status: "published",
        verified_purchase: access.enrolled,
      })
      .select("id, user_id, course_id, rating, comment, status, verified_purchase, video_bucket, video_path, video_mime_type, video_size_bytes, created_at, updated_at, users(full_name)")
      .single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "لديك تقييم سابق لهذا الكورس." });
      throw error;
    }

    res.status(201).json({ ok: true, review: await serializeReview(data) });
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
