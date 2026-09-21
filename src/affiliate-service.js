const supabase = require("./db");

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,40}$/.test(code) ? code : "";
}

async function findActiveAffiliate(code) {
  const affiliateCode = normalizeCode(code);
  if (!affiliateCode) return null;
  const { data, error } = await supabase.from("affiliates").select("*").eq("affiliate_code", affiliateCode).eq("status", "active").maybeSingle();
  if (error) throw error;
  return data || null;
}

async function recordVisit(code, visitorKey) {
  const affiliate = await findActiveAffiliate(code);
  if (!affiliate) return null;
  const safeVisitor = String(visitorKey || "").trim().slice(0, 160);
  const dedupeKey = safeVisitor ? `visit:${affiliate.id}:${safeVisitor}` : null;
  const { error } = await supabase.from("affiliate_events").upsert({
    affiliate_id: affiliate.id,
    event_type: "affiliate_visit",
    dedupe_key: dedupeKey,
    metadata: { attribution: "last_click" },
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
  return { affiliateId: affiliate.id, affiliateCode: affiliate.affiliate_code };
}

async function attributeUser(userId, code) {
  const affiliate = await findActiveAffiliate(code);
  if (!affiliate || !userId) return null;
  const { error: attributionError } = await supabase.from("affiliate_attributions").upsert({
    user_id: userId,
    affiliate_id: affiliate.id,
    clicked_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (attributionError) throw attributionError;
  const { error: eventError } = await supabase.from("affiliate_events").insert({
    affiliate_id: affiliate.id,
    user_id: userId,
    event_type: "affiliate_registration",
    dedupe_key: `registration:${userId}`,
    metadata: { attribution: "last_click" },
  });
  if (eventError && eventError.code !== "23505") throw eventError;
  return affiliate;
}

async function recordAffiliateConversion(payment, eventType) {
  const { data: attribution, error: attributionError } = await supabase.from("affiliate_attributions").select("affiliate_id, user_id").eq("user_id", payment.user_id).maybeSingle();
  if (attributionError) throw attributionError;
  if (!attribution) return null;
  const { data: affiliate, error: affiliateError } = await supabase.from("affiliates").select("id, status, trial_commission_rate, purchase_commission_rate").eq("id", attribution.affiliate_id).maybeSingle();
  if (affiliateError) throw affiliateError;
  if (!affiliate || affiliate.status !== "active") return null;

  const amountCents = Number(payment.amount_cents || 0);
  const rate = Number(eventType === "affiliate_trial" ? affiliate.trial_commission_rate : affiliate.purchase_commission_rate);
  const transactionRef = String(payment.provider_transaction_id || payment.merchant_order_id || payment.id);
  const transactionId = `${eventType}:${transactionRef}`;
  const commissionAmountCents = Math.round(amountCents * rate / 100);
  const eventPayload = {
    affiliate_id: affiliate.id,
    user_id: payment.user_id,
    event_type: eventType,
    amount_cents: amountCents,
    transaction_id: transactionRef,
    metadata: { courseId: payment.course_id, paymentId: payment.id },
    dedupe_key: transactionId,
  };
  const { error: eventError } = await supabase.from("affiliate_events").upsert(eventPayload, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (eventError) throw eventError;
  const { data: commission, error: commissionError } = await supabase.from("affiliate_commissions").upsert({
    affiliate_id: affiliate.id,
    user_id: payment.user_id,
    course_id: payment.course_id,
    payment_id: payment.id,
    transaction_id: transactionId,
    event_type: eventType,
    amount_cents: amountCents,
    commission_rate: rate,
    commission_amount_cents: commissionAmountCents,
    status: "pending",
  }, { onConflict: "payment_id" }).select("*").maybeSingle();
  if (commissionError) throw commissionError;
  return commission || null;
}

module.exports = { normalizeCode, findActiveAffiliate, recordVisit, attributeUser, recordAffiliateConversion };
