const supabase = require("../db");
const { authenticate } = require("./auth");

async function requireAdmin(req, res, next) {
  const userId = authenticate(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "الجلسة منتهية أو غير صالحة، سجّل دخولك مرة أخرى." });
  }
  req.userId = userId;
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.userId)
      .maybeSingle();
    if (error) throw error;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "هذه العملية متاحة للمشرف فقط." });
    }
    next();
  } catch (e) {
    console.error("Admin authorization error:", e);
    return res.status(500).json({ ok: false, error: "تعذر التحقق من صلاحيات المشرف." });
  }
}

module.exports = { requireAdmin };
