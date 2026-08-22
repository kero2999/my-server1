const express = require("express");
const supabase = require("../db");
const whopsdk = require("../whop");
const { verifyHmac, callbackDetails } = require("../paymob");

const router = express.Router();

router.post("/paymob", async (req, res) => {
  try {
    if (typeof req.body !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid raw callback body" });
    }
    const payload = JSON.parse(req.body);
    const signature = req.query.hmac || req.headers["x-paymob-hmac"] || payload.hmac || (payload.obj && payload.obj.hmac);
    if (!signature || !verifyHmac(payload, signature)) {
      return res.status(400).json({ ok: false, error: "Invalid HMAC" });
    }

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
      return res.status(200).json({ received: true, duplicate: true });
    }

    const nextStatus = details.success ? "paid" : "failed";
    const { error: updateError } = await supabase.from("payments").update({
      status: nextStatus,
      provider_transaction_id: details.transactionId,
      raw_callback: details.raw,
      paid_at: details.success ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (updateError) throw updateError;

    if (details.success) {
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

    return res.status(200).json({ received: true, status: nextStatus });
  } catch (e) {
    console.error("Paymob webhook error:", e);
    return res.status(500).json({ ok: false, error: "Webhook processing failed" });
  }
});

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
