const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

module.exports = router;
