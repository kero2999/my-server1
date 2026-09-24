const express = require("express");
const { rateLimit } = require("../middleware/rate-limit");
const { authenticate } = require("../middleware/auth");
const { recordAuditEvent } = require("../audit-service");

const router = express.Router();
const visitLimiter = rateLimit({ name: "page-visits", windowMs: 60 * 1000, max: 60, keyGenerator: (req) => req.ip || "unknown" });

router.post("/visit", visitLimiter, async (req, res) => {
  try {
    const path = String(req.body?.path || "").slice(0, 300);
    if (!path || !path.startsWith("/")) return res.status(400).json({ ok: false, error: "مسار الصفحة غير صالح." });
    const userId = authenticate(req);
    await recordAuditEvent({
      req,
      eventType: "page_view",
      action: "PAGE_VIEW",
      userId,
      metadata: {
        page: path,
        title: String(req.body?.title || "").slice(0, 200),
        referrer: String(req.body?.referrer || "").slice(0, 300),
        visitorId: String(req.body?.visitorId || "").slice(0, 80),
      },
    });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Page visit event error:", error.message);
    return res.status(500).json({ ok: false, error: "تعذر تسجيل الزيارة." });
  }
});

module.exports = router;
