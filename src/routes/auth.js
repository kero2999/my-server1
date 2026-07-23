const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    status: u.whop_status,
  };
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ ok: false, error: "من فضلك املأ جميع الحقول." });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing) {
      return res.status(400).json({ ok: false, error: "يوجد حساب بهذا الإيميل بالفعل." });
    }

    const { data: pending } = await supabase
      .from("pending_activations")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();
    const status = pending ? "active" : "pending";
    const membershipId = pending ? pending.whop_membership_id : null;

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        full_name: fullName.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        whop_status: status,
        whop_membership_id: membershipId,
      })
      .select()
      .single();

    if (error) throw error;

    const token = signToken(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (!user) return res.status(400).json({ ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." });

    const match = await bcrypt.compare(password || "", user.password_hash);
    if (!match) return res.status(400).json({ ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." });

    const token = signToken(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const { data: user } = await supabase.from("users").select("*").eq("id", req.userId).maybeSingle();
  if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });
  res.json({ ok: true, user: publicUser(user) });
});

module.exports = router;
