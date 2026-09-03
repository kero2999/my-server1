const express = require("express");
const crypto = require("crypto");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");
const { createCheckout } = require("../paymob");
const { CAMPAIGN_KEY, findCampaignByCourse, findCampaignTrial, publicCampaignSettings } = require("../campaign-service");
const { getUserCountry } = require("../country-service");

const router = express.Router();
const checkoutLimiter = rateLimit({ name: "payment-checkout", windowMs: 10 * 60 * 1000, max: 5, keyGenerator: (req) => String(req.userId || req.ip || "unknown") });

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}

async function findPublishedCourse(identifier) {
  let query = supabase
    .from("courses")
    .select("id, slug, title, price_cents, currency, status")
    .eq("status", "published");
  query = isNumericId(identifier) ? query.eq("id", Number(identifier)) : query.eq("slug", String(identifier));
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

router.post("/course/:courseId/campaign/create", requireAuth, checkoutLimiter, async (req, res) => {
  let payment = null;
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const campaign = await findCampaignByCourse(course.id);
    if (!campaign || campaign.campaign_key !== CAMPAIGN_KEY) return res.status(404).json({ ok: false, error: "الحملة غير مهيأة لهذا الكورس." });
    if (!campaign.enabled) return res.status(409).json({ ok: false, error: "الحملة غير مفعلة حاليًا." });
    const campaignCountry = await getUserCountry(req.userId);
    if (campaignCountry.countryCode !== "EG") return res.status(409).json({ ok: false, error: "دفع الحملة متاح حاليًا بالجنيه المصري فقط. غيّر الدولة إلى مصر أو انتظر تفعيل بوابة الدفع المحلية." });

    const { data: existingEnrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", req.userId)
      .eq("course_id", course.id)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (existingEnrollment && existingEnrollment.status === "active") return res.status(409).json({ ok: false, error: "هذا الكورس موجود بالفعل في حسابك." });

    const existingTrial = await findCampaignTrial(req.userId, course.id);
    if (existingTrial) return res.status(409).json({ ok: false, error: "تم استخدام عرض الحملة لهذا الحساب من قبل." });

    const { data: pendingPayment, error: pendingError } = await supabase
      .from("payments")
      .select("id, merchant_order_id, provider_order_id, amount_cents, currency, status")
      .eq("user_id", req.userId)
      .eq("course_id", course.id)
      .eq("payment_type", "campaign_trial")
      .eq("status", "pending")
      .contains("metadata", { campaignKey: CAMPAIGN_KEY })
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (pendingPayment) return res.status(409).json({ ok: false, error: "لديك طلب دفع للحملة قيد الانتظار. أكمل عملية الدفع الحالية أولًا." });

    const amountCents = Number(campaign.price_cents);
    const durationDays = Number(campaign.duration_days);
    if (!Number.isInteger(amountCents) || amountCents < 1 || !Number.isInteger(durationDays) || durationDays < 1) return res.status(500).json({ ok: false, error: "إعدادات الحملة غير صالحة." });

    const { data: user, error: userError } = await supabase.from("users").select("id, email, full_name").eq("id", req.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });

    const merchantOrderId = `ql_campaign_${req.userId}_${course.id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { data: insertedPayment, error: paymentError } = await supabase.from("payments").insert({
      user_id: req.userId,
      course_id: course.id,
      merchant_order_id: merchantOrderId,
      provider: "paymob",
      amount_cents: amountCents,
      currency: campaign.currency || course.currency || "EGP",
      payment_type: "campaign_trial",
      metadata: { campaignKey: CAMPAIGN_KEY, durationDays, campaignPriceCents: amountCents },
      status: "pending",
    }).select("id, merchant_order_id, amount_cents, currency, status, payment_type").single();
    if (paymentError) throw paymentError;
    payment = insertedPayment;

    const checkout = await createCheckout({ amountCents, currency: campaign.currency || course.currency || "EGP", merchantOrderId, user: { email: user.email, fullName: user.full_name } });
    const { error: updateError } = await supabase.from("payments").update({ provider_order_id: checkout.providerOrderId, updated_at: new Date().toISOString() }).eq("id", payment.id);
    if (updateError) throw updateError;

    res.status(201).json({ ok: true, payment: Object.assign({}, payment, { providerOrderId: checkout.providerOrderId }), campaign: publicCampaignSettings(campaign, course), checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error("Campaign payment creation error:", error);
    if (payment && payment.id) await supabase.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
    if (error.message === "PAYMOB_API_KEY_MISSING" || error.message === "PAYMOB_INTEGRATION_ID_MISSING" || error.message === "PAYMOB_IFRAME_ID_MISSING") return res.status(503).json({ ok: false, error: "الدفع غير مفعّل بعد على السيرفر. أضف إعدادات Paymob Sandbox أولًا." });
    if (error.message === "PAYMOB_INTEGRATION_ID_INVALID") return res.status(503).json({ ok: false, error: "إعداد Paymob Integration غير صالح." });
    if (error.message === "PAYMOB_UPSTREAM_ERROR") return res.status(502).json({ ok: false, error: "تعذّر إنشاء جلسة دفع الحملة من Paymob حاليًا." });
    res.status(500).json({ ok: false, error: "تعذّر إنشاء طلب دفع الحملة حاليًا." });
  }
});

router.post("/course/:courseId/create", requireAuth, checkoutLimiter, async (req, res) => {
  let payment = null;
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const purchaseCountry = await getUserCountry(req.userId);
    if (purchaseCountry.countryCode !== "EG") return res.status(409).json({ ok: false, error: "الدفع المحلي لهذه الدولة قيد الإعداد حاليًا. يمكنك تصفح المحتوى، وسيظهر السعر من لوحة الإدارة عند اكتمال بوابة الدفع." });

    const { data: existingEnrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", req.userId)
      .eq("course_id", course.id)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (existingEnrollment && existingEnrollment.status === "active") {
      return res.status(409).json({ ok: false, error: "هذا الكورس موجود بالفعل في حسابك." });
    }

    const amountCents = Number(course.price_cents || 0);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      return res.status(500).json({ ok: false, error: "سعر الكورس غير صالح في قاعدة البيانات." });
    }

    if (amountCents === 0) {
      const { data: enrollment, error } = await supabase
        .from("enrollments")
        .upsert({
          user_id: req.userId,
          course_id: course.id,
          status: "active",
          source: "free",
          purchased_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,course_id" })
        .select("id, status, source, purchased_at")
        .single();
      if (error) throw error;
      return res.status(201).json({ ok: true, free: true, enrollment });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("id", req.userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });

    const merchantOrderId = `ql_${req.userId}_${course.id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { data: insertedPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: req.userId,
        course_id: course.id,
        merchant_order_id: merchantOrderId,
        provider: "paymob",
        amount_cents: amountCents,
        currency: course.currency || "EGP",
        status: "pending",
      })
      .select("id, merchant_order_id, amount_cents, currency, status")
      .single();
    if (paymentError) throw paymentError;
    payment = insertedPayment;

    const checkout = await createCheckout({
      amountCents,
      currency: course.currency || "EGP",
      merchantOrderId,
      user: { email: user.email, fullName: user.full_name },
    });

    const { error: updateError } = await supabase
      .from("payments")
      .update({ provider_order_id: checkout.providerOrderId, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updateError) throw updateError;

    res.status(201).json({
      ok: true,
      payment: Object.assign({}, payment, { providerOrderId: checkout.providerOrderId }),
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (e) {
    console.error("Payment creation error:", e);
    if (payment && payment.id) {
      await supabase.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
    }
    if (e.message === "PAYMOB_API_KEY_MISSING" || e.message === "PAYMOB_INTEGRATION_ID_MISSING" || e.message === "PAYMOB_WALLET_INTEGRATION_ID_MISSING" || e.message === "PAYMOB_IFRAME_ID_MISSING") {
      return res.status(503).json({ ok: false, error: "الدفع غير مفعّل بعد على السيرفر. أضف إعدادات Paymob أولًا." });
    }
    if (e.message === "PAYMOB_INTEGRATION_ID_INVALID") {
      return res.status(503).json({ ok: false, error: "إعداد PAYMOB_INTEGRATION_ID غير صالح." });
    }
    if (e.message === "PAYMOB_UPSTREAM_ERROR") {
      return res.status(502).json({ ok: false, error: "تعذّر إنشاء جلسة الدفع من Paymob حاليًا." });
    }
    res.status(500).json({ ok: false, error: "تعذّر إنشاء طلب الدفع حاليًا." });
  }
});

module.exports = router;
