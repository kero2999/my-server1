const express = require("express");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");
const { recordAuditEvent } = require("../audit-service");

const router = express.Router();
const MAX_COMMENT_LENGTH = 2000;
const createLimiter = rateLimit({ name: "platform-review-create", windowMs: 15 * 60 * 1000, max: 5, keyGenerator: (req) => String(req.userId || req.ip || "unknown") });

function publicReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment || "",
    reviewerName: row.users?.full_name || "طالب QuadraLevel",
    status: row.status,
    createdAt: row.created_at,
  };
}

const reviewSelect = "id, user_id, rating, comment, status, created_at, updated_at, users(full_name)";

// GET /api/platform-reviews — public published platform reviews and summary.
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("platform_reviews")
      .select(reviewSelect)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = data || [];
    const total = rows.length;
    const average = total ? Math.round((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / total) * 100) / 100 : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach((row) => { distribution[row.rating] = (distribution[row.rating] || 0) + 1; });
    res.json({ ok: true, summary: { average, total, distribution }, reviews: rows.map(publicReview) });
  } catch (error) {
    console.error("Public platform reviews error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل تقييمات المنصة حاليًا." });
  }
});

// GET /api/platform-reviews/mine — current user's platform review.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("platform_reviews").select(reviewSelect).eq("user_id", req.userId).maybeSingle();
    if (error) throw error;
    res.json({ ok: true, review: data ? publicReview(data) : null });
  } catch (error) {
    console.error("My platform review error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل تقييمك للمنصة حاليًا." });
  }
});

// POST /api/platform-reviews — one platform review per authenticated account.
router.post("/", requireAuth, createLimiter, async (req, res) => {
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const rating = Number(input.rating);
    const comment = String(input.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: "اختر تقييمًا من نجمة إلى 5 نجوم." });
    if (comment.length > MAX_COMMENT_LENGTH) return res.status(400).json({ ok: false, error: "التعليق طويل جدًا. الحد الأقصى 2000 حرف." });

    const { data: existing, error: existingError } = await supabase.from("platform_reviews").select("id").eq("user_id", req.userId).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.status(409).json({ ok: false, error: "لديك تقييم سابق للمنصة." });

    const { data, error } = await supabase.from("platform_reviews").insert({
      user_id: req.userId,
      rating,
      comment,
      status: "pending",
    }).select(reviewSelect).single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "لديك تقييم سابق للمنصة." });
      throw error;
    }
    await recordAuditEvent({ req, eventType: "platform_review_submitted", action: "PLATFORM_REVIEW_SUBMITTED", userId: req.userId, metadata: { reviewId: data.id, rating } });
    res.status(201).json({ ok: true, review: publicReview(data), moderation: "pending" });
  } catch (error) {
    console.error("Create platform review error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ تقييم المنصة حاليًا." });
  }
});

module.exports = router;
