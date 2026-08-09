const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const brevo = require("@getbrevo/brevo");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const apiInstance = new brevo.TransactionalEmailsApi();

if (process.env.BREVO_API_KEY) {
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
  );
}

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
  console.log("🔥 FORGOT PASSWORD ROUTE WAS CALLED");

  const genericOk = {
    ok: true,
    message: "لو الإيميل مسجل، هيوصلك رابط إعادة تعيين."
  };

  try {
    console.log("STEP 1: Reading email");

    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    console.log("STEP 2: Email received:", normalizedEmail);

    if (!normalizedEmail) {
      console.log("STEP 3: Empty email");
      return res.json(genericOk);
    }

    console.log("STEP 4: Querying Supabase users");

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    console.log("STEP 5: Supabase query completed");
    console.log("USER FOUND:", !!user);
    console.log("SUPABASE ERROR:", userError);

    if (userError) throw userError;

    if (!user) {
      console.log("STEP 6: User not found");
      return res.json(genericOk);
    }

    console.log("STEP 7: Creating reset token");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    console.log("STEP 8: Inserting password reset");

    const { error: resetError } = await supabase
      .from("password_resets")
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    console.log("STEP 9: Password reset insert completed");
    console.log("RESET ERROR:", resetError);

    if (resetError) throw resetError;

    const resetUrl =
      `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    console.log("STEP 10: Reset URL created");
    console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

    console.log("========== BREVO DEBUG ==========");
    console.log("BREVO_API_KEY EXISTS:", !!process.env.BREVO_API_KEY);
    console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
    console.log("TO:", user.email);

    if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM) {
      console.log("STEP 11: Starting Brevo email");

      const sendSmtpEmail = new brevo.SendSmtpEmail();

      sendSmtpEmail.sender = {
        email: process.env.EMAIL_FROM,
        name: "Marketing Platform"
      };

      sendSmtpEmail.to = [
        {
          email: user.email,
          name: user.full_name || ""
        }
      ];

      sendSmtpEmail.subject =
        "إعادة تعيين كلمة السر — منصة التسويق التعليمية";

      sendSmtpEmail.htmlContent = `
        <div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;">
          <h2>إعادة تعيين كلمة السر</h2>
          <p>مرحبًا ${user.full_name || ""}،</p>
          <p>
            وصلنا طلب لإعادة تعيين كلمة السر الخاصة بحسابك.
          </p>
          <p>
            <a href="${resetUrl}">
              إعادة تعيين كلمة السر
            </a>
          </p>
          <p>
            الرابط صالح لمدة ساعة واحدة.
          </p>
        </div>
      `;

      console.log("STEP 12: Calling Brevo API");

      await apiInstance.sendTransacEmail(sendSmtpEmail);

      console.log("STEP 13: EMAIL SENT SUCCESSFULLY");
    } else {
      console.warn("STEP 11: Brevo environment variables are missing");
      console.warn("BREVO_API_KEY EXISTS:", !!process.env.BREVO_API_KEY);
      console.warn("EMAIL_FROM:", process.env.EMAIL_FROM);
    }

    console.log("STEP 14: Returning response");

    return res.json(genericOk);

  } catch (e) {
    console.error("🔥 FORGOT PASSWORD ERROR:");
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
