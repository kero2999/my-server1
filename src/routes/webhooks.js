const express = require("express");
const supabase = require("../db");
const whopsdk = require("../whop");
const { verifyHmac, callbackDetails } = require("../paymob");
const { CAMPAIGN_KEY, findCampaignByKey, campaignExpiry } = require("../campaign-service");

const router = express.Router();

router.post("/paymob", async (req, res) => {
  const bodyType = typeof req.body;
  const bodyLength = bodyType === "string" ? req.body.length : 0;
  const querySignature = typeof req.query.hmac === "string" ? req.query.hmac : "";
  const headerSignature = typeof req.headers["x-paymob-hmac"] === "string" ? req.headers["x-paymob-hmac"] : "";

  console.log("[Paymob webhook] received", {
    method: req.method,
    path: req.path,
    bodyType,
    bodyLength,
    contentType: req.headers["content-type"] || null,
    hasQueryHmac: Boolean(querySignature),
    hasHeaderHmac: Boolean(headerSignature),
  });

  try {
    if (typeof req.body !== "string") {
      console.warn("[Paymob webhook] rejected", { reason: "body_not_raw_text", bodyType });
      return res.status(400).json({ ok: false, error: "Invalid raw callback body" });
    }

    let payload;
    try {
      payload = JSON.parse(req.body);
    } catch (error) {
      console.warn("[Paymob webhook] rejected", { reason: "invalid_json", bodyLength });
      return res.status(400).json({ ok: false, error: "Invalid callback JSON" });
    }

    const payloadSignature = payload && typeof payload.hmac === "string" ? payload.hmac : "";
    const nestedSignature = payload && payload.obj && typeof payload.obj.hmac === "string" ? payload.obj.hmac : "";
    const signature = querySignature || headerSignature || payloadSignature || nestedSignature;
    const signatureSource = querySignature ? "query" : headerSignature ? "header" : payloadSignature ? "body" : nestedSignature ? "body.obj" : "none";

    let validHmac = false;
    try {
      validHmac = Boolean(signature && verifyHmac(payload, signature));
    } catch (error) {
      console.error("[Paymob webhook] HMAC configuration/error:", error.message);
      return res.status(503).json({ ok: false, error: "Webhook configuration unavailable" });
    }

    if (!validHmac) {
      console.warn("[Paymob webhook] rejected", { reason: signature ? "invalid_hmac" : "missing_hmac", signatureSource });
      return res.status(400).json({ ok: false, error: "Invalid HMAC" });
    }

    console.log("[Paymob webhook] accepted", {
      signatureSource,
      hasObj: Boolean(payload && payload.obj),
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 20) : [],
    });

    const details = callbackDetails(payload);
    if (!details.transactionId || !details.providerOrderId) {
      return res.status(400).json({ ok: false, error: "Incomplete Paymob callback" });
    }

    let paymentQuery = supabase.from("payments").select("*").eq("provider_order_id", details.providerOrderId);
    let { data: payment, error } = await paymentQuery.maybeSingle();
    if (error) throw error;
    if (!payment && details.merchantOrderId) {
      const result = await supabase.from("payments").select("*").eq("merchant_order_id", details.merchantOrderId).maybeSingle();
      payment = result.data;
      error = result.error;
      if (error) throw error;
    }
    if (!payment) {
      console.warn("Paymob callback did not match a local payment:", details.providerOrderId);
      return res.status(200).json({ received: true, matched: false });
    }

    if (Number(payment.amount_cents) !== details.amountCents || String(payment.currency).toUpperCase() !== String(details.currency).toUpperCase()) {
      console.error("Paymob callback amount/currency mismatch:", { payment, details });
      return res.status(400).json({ ok: false, error: "Payment data mismatch" });
    }

    if (payment.status === "paid") {
      if (payment.payment_type === "campaign_trial") await activateCampaignTrial(payment);
      return res.status(200).json({ received: true, duplicate: true });
    }

    const nextStatus = details.success ? "paid" : "failed";
    const paidAt = details.success ? new Date().toISOString() : null;
    const { error: updateError } = await supabase.from("payments").update({
      status: nextStatus,
      provider_transaction_id: details.transactionId,
      raw_callback: details.raw,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (updateError) throw updateError;

    if (details.success) {
      if (payment.payment_type === "campaign_trial") {
        await activateCampaignTrial({ ...payment, status: "paid", paid_at: paidAt });
      } else {
        const { error: enrollmentError } = await supabase.from("enrollments").upsert({
          user_id: payment.user_id,
          course_id: payment.course_id,
          status: "active",
          source: "paymob",
          payment_id: payment.id,
          purchased_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,course_id" });
        if (enrollmentError) throw enrollmentError;
      }
    }

    return res.status(200).json({ received: true, status: nextStatus });
  } catch (e) {
    console.error("Paymob webhook error:", e);
    return res.status(500).json({ ok: false, error: "Webhook processing failed" });
  }
});

async function activateCampaignTrial(payment) {
  const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  const campaignKey = String(metadata.campaignKey || CAMPAIGN_KEY);
  const campaign = await findCampaignByKey(campaignKey);
  if (!campaign || Number(campaign.course_id) !== Number(payment.course_id)) throw new Error("CAMPAIGN_NOT_CONFIGURED");

  const durationDays = Number(metadata.durationDays || campaign.duration_days);
  const startedAt = payment.paid_at || new Date().toISOString();
  const expiresAt = campaignExpiry(startedAt, durationDays);
  if (!expiresAt) throw new Error("CAMPAIGN_DURATION_INVALID");

  const { error: trialError } = await supabase.from("campaign_trials").insert({
    campaign_key: campaignKey,
    user_id: payment.user_id,
    course_id: payment.course_id,
    payment_id: payment.id,
    duration_days: durationDays,
    status: "active",
    started_at: startedAt,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (trialError && trialError.code !== "23505") throw trialError;
}

router.post("/whop", (req, res) => {
  if (!whopsdk) return res.status(503).json({ ok: false, error: "Whop integration is disabled." });
  let event;
  try {
    const headers = Object.fromEntries(Object.entries(req.headers));
    event = whopsdk.webhooks.unwrap(req.body, { headers });
  } catch (e) {
    console.error("Webhook signature verification failed:", e.message);
    return res.status(400).json({ ok: false, error: "Invalid signature" });
  }

  res.status(200).json({ received: true });

  handleEvent(event).catch((e) => console.error("Error handling Whop event:", e));
});

async function handleEvent(event) {
  const type = event.type;
  const data = event.data || {};

  const email = (data.user && data.user.email) || data.email || null;
  const membershipId = data.id || data.membership_id || null;

  if (!email) {
    console.warn("Whop event without an email, skipping:", type);
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  if (type === "membership.went_valid" || type === "payment.succeeded") {
    await activateByEmail(normalizedEmail, membershipId);
  } else if (type === "membership.went_invalid") {
    await deactivateByEmail(normalizedEmail);
  } else {
    console.log("Unhandled Whop event type:", type);
  }
}

async function activateByEmail(email, membershipId) {
  const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();

  if (user) {
    await supabase
      .from("users")
      .update({ whop_status: "active", whop_membership_id: membershipId })
      .eq("id", user.id);
    console.log("Activated existing user:", email);
  } else {
    await supabase
      .from("pending_activations")
      .upsert({ email, whop_membership_id: membershipId, status: "active" });
    console.log("Stored pending activation for:", email);
  }
}

async function deactivateByEmail(email) {
  const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (user) {
    await supabase.from("users").update({ whop_status: "inactive" }).eq("id", user.id);
    console.log("Deactivated user:", email);
  }
}

module.exports = router;
