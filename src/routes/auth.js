const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { BrevoClient } = require("@getbrevo/brevo");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");

const router = express.Router();
const accountKey = (req) => `${req.ip || "unknown"}:${String(req.body?.email || "").trim().toLowerCase().slice(0, 160)}`;
const registerLimiter = rateLimit({ name: "auth-register", windowMs: 15 * 60 * 1000, max: 5 });
const loginLimiter = rateLimit({ name: "auth-login", windowMs: 15 * 60 * 1000, max: 10, keyGenerator: accountKey });
const recoveryLimiter = rateLimit({ name: "auth-recovery", windowMs: 60 * 60 * 1000, max: 3, keyGenerator: accountKey });
const resetLimiter = rateLimit({ name: "auth-reset", windowMs: 60 * 60 * 1000, max: 10 });
const apiInstance = process.env.BREVO_API_KEY
  ? new BrevoClient({ apiKey: process.env.BREVO_API_KEY, maxRetries: 0, timeoutInSeconds: 15 })
  : null;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[character]));
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    status: u.whop_status, // legacy status retained during marketplace migration
    role: u.role || "user",
  };
}

// POST /api/auth/register
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (typeof fullName !== "string" || typeof email !== "string" || typeof password !== "string" || !fullName.trim() || !email.trim() || !password) {
      return res.status(400).json({ ok: false, error: "من فضلك املأ جميع الحقول." });
    }
    if (fullName.trim().length > 120 || email.trim().length > 320 || password.length > 128) {
      return res.status(400).json({ ok: false, error: "بيانات الحساب أطول من الحد المسموح." });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
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

    // هل فيه اشتراك Whop مستني الإيميل ده؟
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

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || email.length > 320 || password.length > 128) {
      return res.status(400).json({ ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." });
    }
    const normalizedEmail = email.trim().toLowerCase();

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

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const { data: user } = await supabase.from("users").select("*").eq("id", req.userId).maybeSingle();
  if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });
  res.json({ ok: true, user: publicUser(user) });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", recoveryLimiter, async (req, res) => {

  const genericOk = {
    ok: true,
    message: "لو الإيميل مسجل، هيوصلك رابط إعادة تعيين."
  };

  try {

    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();


    if (!normalizedEmail) {
      return res.json(genericOk);
    }


    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();


    if (userError) throw userError;

    if (!user) {
      return res.json(genericOk);
    }


    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);


    const { error: resetError } = await supabase
      .from("password_resets")
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });


    if (resetError) throw resetError;

    const resetUrl =
      `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;



    if (apiInstance && process.env.EMAIL_FROM) {
      const displayName = escapeHtml(user.full_name || "");
      const safeResetUrl = escapeHtml(resetUrl);
      const sendSmtpEmail = {
        sender: {
          email: process.env.EMAIL_FROM,
          name: "Marketing Platform",
        },
        to: [{ email: user.email, name: user.full_name || "" }],
        subject: "إعادة تعيين كلمة السر — منصة التسويق التعليمية",
        htmlContent: `
          <div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;">
            <h2>إعادة تعيين كلمة السر</h2>
            <p>مرحبًا ${displayName}،</p>
            <p>وصلنا طلب لإعادة تعيين كلمة السر الخاصة بحسابك.</p>
            <p><a href="${safeResetUrl}">إعادة تعيين كلمة السر</a></p>
            <p>الرابط صالح لمدة ساعة واحدة.</p>
          </div>
        `,
      };
      await apiInstance.transactionalEmails.sendTransacEmail(sendSmtpEmail);
    }


    return res.json(genericOk);

  } catch (e) {
    console.error("Password recovery error");

    return res.json(genericOk);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", resetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: "بيانات ناقصة." });
    }
    if (typeof newPassword !== "string" || newPassword.length > 128) {
      return res.status(400).json({ ok: false, error: "كلمة المرور غير صالحة." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
    }

    const { data: reset } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: "الرابط غير صالح أو منتهي الصلاحية. اطلب رابط جديد." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", reset.user_id);
    if (updateError) throw updateError;

    await supabase.from("password_resets").update({ used: true }).eq("id", reset.id);

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

module.exports = router;
