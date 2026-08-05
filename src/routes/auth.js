const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    status: u.whop_status, // 'pending' | 'active' | 'inactive'
  };
}

// POST /api/auth/register
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

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const { data: user } = await supabase.from("users").select("*").eq("id", req.userId).maybeSingle();
  if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });
  res.json({ ok: true, user: publicUser(user) });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  // دايمًا نرجّع نفس الرد بغض النظر عن وجود الإيميل من عدمه،
  // عشان محدش يقدر يستخدم الراوت ده عشان يعرف إيه الإيميلات المسجلة عندنا.
  const genericOk = { ok: true, message: "لو الإيميل مسجل، هيوصلك رابط إعادة تعيين." };
  try {
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.json(genericOk);

    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (!user) return res.json(genericOk);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    const { error } = await supabase.from("password_resets").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    if (resend && process.env.EMAIL_FROM) {
      const { data: sendData, error: sendError } = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "إعادة تعيين كلمة السر — منصة التسويق التعليمية",
        html: `
          <div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;">
            <h2>إعادة تعيين كلمة السر</h2>
            <p>مرحبًا ${user.full_name || ""}،</p>
            <p>وصلنا طلب لإعادة تعيين كلمة السر الخاصة بحسابك. اضغط على الرابط ده لإكمال العملية (صالح لمدة ساعة واحدة):</p>
            <p><a href="${resetUrl}" style="color:#ff6f00;font-weight:bold;">إعادة تعيين كلمة السر</a></p>
            <p>لو ما طلبتش ده، تجاهل الإيميل ده ببساطة، وكلمة السر هتفضل زي ما هي.</p>
          </div>
        `,
      });

      console.log("========== RESEND DEBUG ==========");
      console.log("API KEY EXISTS:", !!process.env.RESEND_API_KEY);
      console.log("FROM EMAIL:", process.env.EMAIL_FROM);
      console.log("TO EMAIL:", user.email);

      if (sendError) {
        console.error("RESEND ERROR:");
        console.error(JSON.stringify(sendError, null, 2));
      } else {
        console.log("EMAIL SENT SUCCESSFULLY:");
        console.log(JSON.stringify(sendData, null, 2));
      }

      console.log("==================================");
    } else {
      console.warn("⚠️ RESEND_API_KEY أو EMAIL_FROM غير مضبوطين — لم يتم إرسال إيميل. رابط إعادة التعيين (للتجربة فقط):", resetUrl);
    }

    return res.json(genericOk);
  } catch (e) {
    console.error(e);
    return res.json(genericOk);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: "بيانات ناقصة." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });
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
