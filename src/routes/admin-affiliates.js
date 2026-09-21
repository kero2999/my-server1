const express = require("express");
const supabase = require("../db");
const { requireAdmin } = require("../middleware/admin");
const { normalizeCode } = require("../affiliate-service");

const router = express.Router();
router.use(requireAdmin);

function input(body = {}) {
  const name = String(body.name || "").trim().slice(0, 120);
  const affiliateCode = normalizeCode(body.affiliateCode || body.affiliate_code);
  const platform = String(body.platform || "Other").trim().slice(0, 30);
  const profileUrl = String(body.profileUrl || body.profile_url || "").trim().slice(0, 500) || null;
  const status = ["active", "inactive"].includes(String(body.status || "active")) ? String(body.status || "active") : "";
  const trialRate = Number(body.trialCommissionRate ?? body.trial_commission_rate ?? 100);
  const purchaseRate = Number(body.purchaseCommissionRate ?? body.purchase_commission_rate ?? body.commissionRate ?? body.commission_rate ?? 25);
  if (!name || !affiliateCode || !status || !Number.isFinite(trialRate) || trialRate < 0 || trialRate > 100 || !Number.isFinite(purchaseRate) || purchaseRate < 0 || purchaseRate > 100) return null;
  return { name, affiliate_code: affiliateCode, platform, profile_url: profileUrl, trial_commission_rate: trialRate, purchase_commission_rate: purchaseRate, status };
}

async function withStats(affiliates) {
  const ids = affiliates.map((item) => item.id);
  if (!ids.length) return [];
  const [{ data: events, error: eventsError }, { data: commissions, error: commissionsError }] = await Promise.all([
    supabase.from("affiliate_events").select("affiliate_id, event_type, amount_cents").in("affiliate_id", ids),
    supabase.from("affiliate_commissions").select("affiliate_id, amount_cents, commission_amount_cents, status").in("affiliate_id", ids),
  ]);
  if (eventsError) throw eventsError;
  if (commissionsError) throw commissionsError;
  return affiliates.map((affiliate) => {
    const ownEvents = (events || []).filter((event) => Number(event.affiliate_id) === Number(affiliate.id));
    const ownCommissions = (commissions || []).filter((item) => Number(item.affiliate_id) === Number(affiliate.id));
    return {
      ...affiliate,
      stats: {
        visits: ownEvents.filter((event) => event.event_type === "affiliate_visit").length,
        registrations: ownEvents.filter((event) => event.event_type === "affiliate_registration").length,
        trials: ownEvents.filter((event) => event.event_type === "affiliate_trial").length,
        purchases: ownEvents.filter((event) => event.event_type === "affiliate_purchase").length,
        revenueCents: ownCommissions.filter((item) => item.status !== "cancelled" && item.amount_cents).reduce((sum, item) => sum + Number(item.amount_cents), 0),
        commissionCents: ownCommissions.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + Number(item.commission_amount_cents || 0), 0),
        pendingCommissionCents: ownCommissions.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.commission_amount_cents || 0), 0),
      },
    };
  });
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("affiliates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, affiliates: await withStats(data || []) });
  } catch (error) {
    console.error("Admin affiliates list error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل بيانات المسوقين حاليًا." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "بيانات المسوق غير صالحة." });
    const { data, error } = await supabase.from("affiliates").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "المسوق غير موجود." });
    const [affiliate] = await withStats([data]);
    res.json({ ok: true, affiliate });
  } catch (error) {
    console.error("Admin affiliate details error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل تفاصيل المسوق حاليًا." });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = input(req.body);
    if (!payload) return res.status(400).json({ ok: false, error: "أدخل بيانات المسوق ونسب العمولة بشكل صحيح." });
    const { data, error } = await supabase.from("affiliates").insert(payload).select("*").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "كود Affiliate مستخدم بالفعل." });
      throw error;
    }
    res.status(201).json({ ok: true, affiliate: data });
  } catch (error) {
    console.error("Admin affiliate create error:", error);
    res.status(500).json({ ok: false, error: "تعذر إضافة المسوق حاليًا." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "بيانات المسوق غير صالحة." });
    const { data: current, error: currentError } = await supabase.from("affiliates").select("*").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ ok: false, error: "المسوق غير موجود." });
    const payload = input({ ...current, ...req.body });
    if (!payload) return res.status(400).json({ ok: false, error: "بيانات المسوق غير صالحة." });
    const { data, error } = await supabase.from("affiliates").update(payload).eq("id", id).select("*").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "كود Affiliate مستخدم بالفعل." });
      throw error;
    }
    res.json({ ok: true, affiliate: data });
  } catch (error) {
    console.error("Admin affiliate update error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحديث بيانات المسوق حاليًا." });
  }
});

module.exports = router;
