const express = require("express");
const supabase = require("../db");
const whopsdk = require("../whop");

const router = express.Router();

router.post("/whop", (req, res) => {
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
