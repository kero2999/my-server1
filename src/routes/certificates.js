const express = require("express");
const supabase = require("../db");

const router = express.Router();

// GET /api/certificates/verify/:code — public certificate verification.
router.get("/verify/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!code || code.length > 128) return res.status(400).json({ ok: false, error: "رمز الشهادة غير صالح." });
    const { data, error } = await supabase
      .from("certificates")
      .select("certificate_number, verification_code, issued_at, course_id, courses(title, slug), users(full_name)")
      .eq("verification_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "لم يتم العثور على شهادة بهذا الرمز." });
    res.json({
      ok: true,
      valid: true,
      certificate: {
        certificateNumber: data.certificate_number,
        verificationCode: data.verification_code,
        issuedAt: data.issued_at,
        course: data.courses || null,
        studentName: data.users?.full_name || "",
      },
    });
  } catch (e) {
    console.error("Certificate verification error:", e);
    res.status(500).json({ ok: false, error: "تعذر التحقق من الشهادة حاليًا." });
  }
});

module.exports = router;
