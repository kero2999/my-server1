const express = require("express");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { rateLimit } = require("../middleware/rate-limit");
const {
  DEFAULT_COUNTRY_CODE,
  getCountryConfig,
  getActiveCountryConfig,
  listCountryConfigs,
  getUserCountryState,
  normalizeCountryCode,
  publicCountry,
  saveUserCountry,
} = require("../country-service");

const router = express.Router();
const countryChangeLimiter = rateLimit({ name: "country-change", windowMs: 60 * 60 * 1000, max: 20, keyGenerator: (req) => String(req.userId || req.ip || "unknown") });

function safePublicCountry(country) {
  const value = publicCountry(country) || {};
  return {
    countryCode: value.countryCode,
    countryName: value.countryName,
    dialect: value.dialect,
    currency: value.currency,
    currencySymbol: value.currencySymbol,
    phoneCode: value.phoneCode,
    locale: value.locale,
    uiMessages: value.uiMessages || {},
  };
}

// GET /api/countries — public list for the first-visit picker.
router.get("/", async (req, res) => {
  try {
    const countries = await listCountryConfigs();
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json({ ok: true, defaultCountryCode: DEFAULT_COUNTRY_CODE, countries: countries.map(safePublicCountry) });
  } catch (error) {
    console.error("Countries list error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل الدول المتاحة حاليًا." });
  }
});

// GET /api/countries/me — server-authoritative country for the signed-in user.
router.get("/me", requireAuth, async (req, res) => {
  try {
    const state = await getUserCountryState(req.userId);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, selected: state.selected, countryCode: state.countryCode, country: safePublicCountry(state.country) });
  } catch (error) {
    console.error("User country read error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل إعداد الدولة حاليًا." });
  }
});

// PATCH /api/countries/me — save a valid country only; it never changes access or payment.
router.patch("/me", requireAuth, countryChangeLimiter, async (req, res) => {
  try {
    const countryCode = normalizeCountryCode(req.body?.countryCode || req.body?.country_code);
    if (!countryCode) return res.status(400).json({ ok: false, error: "اختيار الدولة غير صالح." });
    const result = await saveUserCountry(req.userId, countryCode);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, country: safePublicCountry(result.country), user: result.user });
  } catch (error) {
    if (error?.code === "COUNTRY_CODE_INVALID") return res.status(400).json({ ok: false, error: "اختيار الدولة غير صالح." });
    console.error("User country save error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ الدولة حاليًا." });
  }
});

// GET /api/countries/admin/configs — admin-only configuration view.
router.get("/admin/configs", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from("country_configs").select("*").order("country_code", { ascending: true });
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, countries: data || [] });
  } catch (error) {
    console.error("Admin countries read error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل إعدادات الدول." });
  }
});

// POST /api/countries/admin/configs — add a future country without a code change in course pages.
router.post("/admin/configs", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const countryCode = normalizeCountryCode(body.countryCode || body.country_code);
    const countryName = String(body.countryName || body.country_name || "").trim();
    const dialect = String(body.dialect || "").trim();
    const currencyCode = String(body.currencyCode || body.currency_code || "").trim().toUpperCase();
    const currencySymbol = String(body.currencySymbol || body.currency_symbol || "").trim();
    const phoneCode = String(body.phoneCode || body.phone_code || "").trim();
    const locale = String(body.locale || "ar").trim();
    if (!countryCode || !countryName || !dialect || !/^[A-Z]{3}$/.test(currencyCode) || !currencySymbol || !/^[+0-9 -]{2,12}$/.test(phoneCode) || !locale) return res.status(400).json({ ok: false, error: "أكمل كود الدولة واسمها واللهجة والعملة وكود الهاتف." });
    const { data, error } = await supabase.from("country_configs").insert({ country_code: countryCode, country_name: countryName.slice(0, 120), dialect: dialect.slice(0, 120), currency_code: currencyCode, currency_symbol: currencySymbol.slice(0, 20), phone_code: phoneCode.slice(0, 20), locale: locale.slice(0, 40), is_active: body.isActive !== false }).select("*").single();
    if (error) throw error;
    res.status(201).json({ ok: true, country: data });
  } catch (error) {
    if (error?.code === "23505") return res.status(409).json({ ok: false, error: "كود الدولة موجود بالفعل." });
    console.error("Admin country create error:", error);
    res.status(500).json({ ok: false, error: "تعذر إضافة الدولة." });
  }
});

// PATCH /api/countries/admin/configs/:countryCode — edit copy/context, not payments.
router.patch("/admin/configs/:countryCode", requireAdmin, async (req, res) => {
  try {
    const code = normalizeCountryCode(req.params.countryCode);
    if (!code) return res.status(400).json({ ok: false, error: "كود الدولة غير صالح." });
    const body = req.body || {};
    const updates = {};
    const textFields = ["countryName", "dialect", "currencyCode", "currencySymbol", "phoneCode", "locale", "contentVersion", "projectContext"];
    const columns = { countryName: "country_name", dialect: "dialect", currencyCode: "currency_code", currencySymbol: "currency_symbol", phoneCode: "phone_code", locale: "locale", contentVersion: "content_version", projectContext: "project_context" };
    textFields.forEach((field) => {
      if (body[field] !== undefined && typeof body[field] === "string" && body[field].trim()) updates[columns[field]] = body[field].trim().slice(0, 1000);
    });
    ["uiMessages", "mentorContext", "lessonContexts", "quizContexts"].forEach((field) => {
      if (body[field] !== undefined && body[field] && typeof body[field] === "object" && !Array.isArray(body[field])) updates[field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = body[field];
    });
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return res.status(400).json({ ok: false, error: "isActive يجب أن يكون Boolean." });
      updates.is_active = body.isActive;
    }
    if (updates.currency_code && !/^[A-Z]{3}$/.test(updates.currency_code.toUpperCase())) return res.status(400).json({ ok: false, error: "كود العملة غير صالح." });
    if (!Object.keys(updates).length) return res.status(400).json({ ok: false, error: "لا توجد إعدادات صالحة للحفظ." });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("country_configs").update(updates).eq("country_code", code).select("*").single();
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, country: data });
  } catch (error) {
    console.error("Admin country update error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ إعدادات الدولة." });
  }
});

// GET /api/countries/admin/courses/:courseId/pricing — display pricing only.
router.get("/admin/courses/:courseId/pricing", requireAdmin, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ ok: false, error: "course_id غير صالح." });
    const { data, error } = await supabase.from("course_country_pricing").select("*").eq("course_id", courseId).order("country_code", { ascending: true });
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, pricing: data || [] });
  } catch (error) {
    console.error("Admin course pricing read error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل أسعار الدول." });
  }
});

// PUT /api/countries/admin/courses/:courseId/pricing/:countryCode — display pricing only.
router.put("/admin/courses/:courseId/pricing/:countryCode", requireAdmin, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const countryCode = normalizeCountryCode(req.params.countryCode);
    const priceCents = Number(req.body?.priceCents);
    const currency = String(req.body?.currency || "").trim().toUpperCase();
    if (!Number.isInteger(courseId) || courseId <= 0 || !countryCode || !Number.isInteger(priceCents) || priceCents < 0 || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ ok: false, error: "بيانات السعر غير صالحة." });
    const { data, error } = await supabase.from("course_country_pricing").upsert({ course_id: courseId, country_code: countryCode, price_cents: priceCents, currency, is_active: req.body?.isActive !== false, updated_at: new Date().toISOString() }, { onConflict: "course_id,country_code" }).select("*").single();
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, pricing: data });
  } catch (error) {
    console.error("Admin course pricing update error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ سعر الدولة." });
  }
});

// GET /api/countries/admin/courses/:courseId/variants — inspect country variants.
router.get("/admin/courses/:courseId/variants", requireAdmin, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ ok: false, error: "course_id غير صالح." });
    const [lessons, quizzes, projects] = await Promise.all([
      supabase.from("lesson_country_variants").select("*").eq("course_id", courseId).order("country_code").order("lesson_key"),
      supabase.from("quiz_country_variants").select("*").eq("course_id", courseId).order("country_code").order("quiz_key"),
      supabase.from("project_country_variants").select("*").eq("course_id", courseId).order("country_code").order("project_key"),
    ]);
    const error = [lessons, quizzes, projects].find((result) => result.error)?.error;
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, variants: { lessons: lessons.data || [], quizzes: quizzes.data || [], projects: projects.data || [] } });
  } catch (error) {
    console.error("Admin country variants read error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل نسخ المحتوى حسب الدولة." });
  }
});

// PUT /api/countries/admin/courses/:courseId/variants/:kind/:countryCode/:itemKey — upsert a localized variant.
router.put("/admin/courses/:courseId/variants/:kind/:countryCode/:itemKey", requireAdmin, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const countryCode = normalizeCountryCode(req.params.countryCode);
    const itemKey = String(req.params.itemKey || "").trim();
    const definition = { lesson: { table: "lesson_country_variants", key: "lesson_key", id: "lesson_id" }, quiz: { table: "quiz_country_variants", key: "quiz_key", id: "quiz_id" }, project: { table: "project_country_variants", key: "project_key", id: "project_id" } }[String(req.params.kind || "").toLowerCase()];
    const itemId = Number(req.body?.itemId);
    if (!definition || !Number.isInteger(courseId) || courseId <= 0 || !countryCode || !itemKey || !Number.isInteger(itemId) || itemId <= 0) return res.status(400).json({ ok: false, error: "بيانات نسخة المحتوى غير صالحة." });
    const value = { course_id: courseId, country_code: countryCode, [definition.key]: itemKey, [definition.id]: itemId, title: typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 500) : null, is_active: req.body?.isActive !== false, updated_at: new Date().toISOString() };
    if (definition.table === "lesson_country_variants") Object.assign(value, { summary: String(req.body?.summary || "").slice(0, 2000), content_html: String(req.body?.contentHtml || "").slice(0, 200000), market_examples: req.body?.marketExamples && typeof req.body.marketExamples === "object" ? req.body.marketExamples : [] });
    if (definition.table === "quiz_country_variants") Object.assign(value, { questions: Array.isArray(req.body?.questions) ? req.body.questions : [], scenario_context: String(req.body?.scenarioContext || "").slice(0, 2000) });
    if (definition.table === "project_country_variants") Object.assign(value, { instructions: String(req.body?.instructions || "").slice(0, 12000) });
    const conflict = `${definition.id},country_code`;
    const { data, error } = await supabase.from(definition.table).upsert(value, { onConflict: conflict }).select("*").single();
    if (error) throw error;
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, variant: data });
  } catch (error) {
    console.error("Admin country variant update error:", error);
    res.status(500).json({ ok: false, error: "تعذر حفظ نسخة المحتوى حسب الدولة." });
  }
});

// GET /api/countries/:countryCode — public sanitized details for a selected code.
router.get("/:countryCode", async (req, res) => {
  try {
    const code = normalizeCountryCode(req.params.countryCode);
    if (!code) return res.status(404).json({ ok: false, error: "الدولة غير موجودة." });
    const country = await getActiveCountryConfig(code);
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json({ ok: true, country: safePublicCountry(country) });
  } catch (error) {
    if (error?.code === "COUNTRY_NOT_ACTIVE") return res.status(404).json({ ok: false, error: "الدولة غير متاحة حاليًا." });
    console.error("Country details error:", error);
    res.status(500).json({ ok: false, error: "تعذر تحميل إعداد الدولة حاليًا." });
  }
});

module.exports = router;
