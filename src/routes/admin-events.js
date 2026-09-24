const express = require("express");
const supabase = require("../db");
const { requireAdmin } = require("../middleware/admin");
const { recordAuditEvent } = require("../audit-service");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const limit = Math.max(10, Math.min(100, Number(req.query.limit) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabase.from("audit_events").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (req.query.eventType) query = query.eq("event_type", String(req.query.eventType).slice(0, 80));
    if (req.query.status) query = query.eq("status", String(req.query.status).slice(0, 30));
    if (req.query.userId && /^\d+$/.test(String(req.query.userId))) query = query.eq("user_id", Number(req.query.userId));
    if (req.query.courseId && /^\d+$/.test(String(req.query.courseId))) query = query.eq("course_id", Number(req.query.courseId));
    if (req.query.search) {
      const search = String(req.query.search).replace(/[,()]/g, " ").trim().slice(0, 80);
      if (search) query = query.or(`action.ilike.%${search}%,path.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ ok: true, events: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
  } catch (error) {
    console.error("Admin events list error:", error);
    return res.status(500).json({ ok: false, error: "تعذر تحميل سجل الأحداث حاليًا." });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("audit_events").select("event_type,status,created_at").gte("created_at", since).limit(10000);
    if (error) throw error;
    const summary = {};
    for (const event of data || []) {
      const key = event.event_type || "system";
      if (!summary[key]) summary[key] = { total: 0, errors: 0 };
      summary[key].total += 1;
      if (event.status === "error") summary[key].errors += 1;
    }
    return res.json({ ok: true, since, summary });
  } catch (error) {
    console.error("Admin events summary error:", error);
    return res.status(500).json({ ok: false, error: "تعذر تحميل ملخص الأحداث حاليًا." });
  }
});

module.exports = router;
