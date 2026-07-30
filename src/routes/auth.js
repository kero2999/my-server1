const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const supabase = require("../db");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // ساعة واحدة

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "30d";

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.whop_status,
    createdAt: row.created_at,
  };
}

/* ---------------- POST /api/auth/register ---------------- */
router.post("/register", async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!fullName || !email || !password) {
      return res.json({ ok: false, error: "من فضلك املأ جميع الحقول." });
    }
    if (password.length < 4) {
      return res.json({ ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." });
    }

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return res.json({ ok: false, error: "يوجد حساب بهذا الإيميل بالفعل." });
    }

    // هل اشتراك الطالب اتفعّل قبل ما يعمل حساب؟ (وصل webhook من Whop الأول)
    const { data: pending } = await supabase
      .from("pending_activations")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: inserted, error } = await supabase
      .from("users")
      .insert({
        full_name: fullName,
        email,
        password_hash: passwordHash,
        whop_status: pending ? pending.status : "pending",
        whop_membership_id: pending ? pending.whop_membership_id : null,
      })
      .select()
      .single();

    if (error) throw error;

    if (pending) {
      await supabase.from("pending_activations").delete().eq("email", email);
    }

    const token = signToken(inserted);
    return res.json({ ok: true, token, user: publicUser(inserted) });
  } catch (err) {
    console.error("register error:", err);
    return res.json({ ok: false, error: "حدث خطأ أثناء إنشاء الحساب." });
  }
});

/* ---------------- POST /api/auth/login ---------------- */
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.json({ ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.json({ ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." });
    }

    const token = signToken(user);
    return res.json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.json({ ok: false, error: "حدث خطأ أثناء تسجيل الدخول." });
  }
});

/* ---------------- Auth middleware ---------------- */
function requireToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "غير مصرح." });

  try {
    req.authUserId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "الجلسة منتهية، سجّل دخول تاني." });
  }
}

/* ---------------- GET /api/auth/me ---------------- */
router.get("/me", requireToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.authUserId)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.json({ ok: false, error: "المستخدم غير موجود." });

    return res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error("me error:", err);
    return res.json({ ok: false, error: "حدث خطأ." });
  }
});

/* ---------------- POST /api/auth/forgot-password ---------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.json({ ok: false, error: "من فضلك اكتب الإيميل." });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle();

    // ملحوظة أمان: بنرجّع نفس الرسالة سواء الإيميل موجود أو لأ،
    // عشان محدش يقدر يعرف إيميلات مسجّلة عندنا من غيرها.
    if (!user) {
      return res.json({ ok: true, message: "لو الإيميل ده مسجّل عندنا، هيوصلك رابط إعادة التعيين." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    const { error } = await supabase.from("password_resets").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });
    if (error) throw error;

    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: user.email,
      subject: "إعادة تعيين كلمة السر",
      html: `<p>مرحبًا ${user.full_name || ""}،</p>
             <p>اضغط على الرابط ده عشان تعيد تعيين كلمة السر (صالح لمدة ساعة):</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>لو مطلبتش الرسالة دي، تجاهلها.</p>`,
    });

    return res.json({ ok: true, message: "لو الإيميل ده مسجّل عندنا، هيوصلك رابط إعادة التعيين." });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.json({ ok: false, error: "حدث خطأ، حاول تاني لاحقًا." });
  }
});

/* ---------------- POST /api/auth/reset-password ---------------- */
router.post("/reset-password", async (req, res) => {
  try {
    const token = (req.body.token || "").trim();
    const password = req.body.password || "";

    if (!token || !password) {
      return res.json({ ok: false, error: "بيانات ناقصة." });
    }
    if (password.length < 4) {
      return res.json({ ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." });
    }

    const { data: resetRow, error: findError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (findError) throw findError;
    if (!resetRow || resetRow.used || new Date(resetRow.expires_at) < new Date()) {
      return res.json({ ok: false, error: "الرابط غير صالح أو منتهي الصلاحية، اطلب رابط جديد." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", resetRow.user_id);
    if (updateError) throw updateError;

    await supabase.from("password_resets").update({ used: true }).eq("id", resetRow.id);

    return res.json({ ok: true, message: "تم تغيير كلمة السر بنجاح." });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.json({ ok: false, error: "حدث خطأ، حاول تاني لاحقًا." });
  }
});

module.exports = router;
