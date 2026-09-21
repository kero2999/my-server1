const express = require("express");
const { recordVisit, normalizeCode } = require("../affiliate-service");

const router = express.Router();

router.post("/track", async (req, res) => {
  try {
    const result = await recordVisit(req.body?.code, req.body?.visitorKey);
    res.json({ ok: true, tracked: Boolean(result), affiliateCode: result?.affiliateCode || null });
  } catch (error) {
    console.error("Affiliate visit error:", error);
    res.status(500).json({ ok: false, error: "تعذر تسجيل الزيارة حاليًا." });
  }
});

router.get("/validate/:code", async (req, res) => {
  res.json({ ok: true, valid: Boolean(normalizeCode(req.params.code)) });
});

module.exports = router;
