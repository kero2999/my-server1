const express = require("express");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/projects/submit — نسخة احتياطية من مشروع التخرج (التحقق الفعلي بيحصل في المتصفح)
router.post("/submit", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: "المشروع فارغ." });
    }

    const { data: user } = await supabase.from("users").select("email").eq("id", req.userId).maybeSingle();
    if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });

    const { error } = await supabase.from("project_submissions").insert({
      user_id: req.userId,
      email: user.email,
      content: text.trim(),
    });
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "تعذّر حفظ المشروع، حاول مرة أخرى." });
  }
});

module.exports = router;
