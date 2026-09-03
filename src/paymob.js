const crypto = require("crypto");

const API_BASE_URL = process.env.PAYMOB_API_BASE_URL || "https://accept.paymob.com/api";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

async function paymobRequest(path, body) {
  const response = await fetch(API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Paymob API error:", response.status, data);
    throw new Error("PAYMOB_UPSTREAM_ERROR");
  }
  return data;
}

function normalizedBilling(user) {
  const parts = String(user.fullName || "Quadra Level Customer").trim().split(/\s+/);
  return {
    first_name: (parts.shift() || "Customer").slice(0, 50),
    last_name: (parts.join(" ") || "User").slice(0, 50),
    email: String(user.email || "customer@example.com").slice(0, 100),
    phone_number: String(user.phone || process.env.PAYMOB_DEFAULT_PHONE || "+201000000000").slice(0, 20),
    apartment: "NA",
    floor: "NA",
    street: "NA",
    building: "NA",
    shipping_method: "PKG",
    postal_code: "NA",
    city: "Cairo",
    state: "Cairo",
    country: "EG",
  };
}

async function createCheckout({ amountCents, currency, merchantOrderId, user, paymentMethod = "card" }) {
  const apiKey = required("PAYMOB_API_KEY");
  const integrationEnv = paymentMethod === "wallet" ? "PAYMOB_WALLET_INTEGRATION_ID" : "PAYMOB_INTEGRATION_ID";
  const integrationId = Number(required(integrationEnv));
  const iframeId = required("PAYMOB_IFRAME_ID");
  if (!Number.isInteger(integrationId)) throw new Error("PAYMOB_INTEGRATION_ID_INVALID");

  const auth = await paymobRequest("/auth/tokens", { api_key: apiKey });
  const order = await paymobRequest("/ecommerce/orders", {
    auth_token: auth.token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: currency || "EGP",
    merchant_order_id: merchantOrderId,
    items: [],
  });
  const paymentKey = await paymobRequest("/acceptance/payment_keys", {
    auth_token: auth.token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: order.id,
    billing_data: normalizedBilling(user),
    currency: currency || "EGP",
    integration_id: integrationId,
    lock_order_when_paid: true,
  });

  return {
    providerOrderId: String(order.id),
    paymentToken: paymentKey.token,
    checkoutUrl: `https://accept.paymob.com/api/acceptance/iframes/${encodeURIComponent(iframeId)}?payment_token=${encodeURIComponent(paymentKey.token)}`,
  };
}

function legacyHmacPayload(obj) {
  const order = obj && obj.order ? obj.order : {};
  const source = obj && obj.source_data ? obj.source_data : {};
  return [
    obj && obj.amount_cents,
    obj && obj.created_at,
    obj && obj.currency,
    obj && obj.error_occured,
    obj && obj.has_parent_transaction,
    obj && obj.id,
    obj && obj.integration_id,
    obj && obj.is_3d_secure,
    obj && obj.is_auth,
    obj && obj.is_capture,
    obj && obj.is_refunded,
    obj && obj.is_standalone_payment,
    obj && obj.is_voided,
    order.id,
    obj && obj.owner,
    obj && obj.pending,
    source.pan,
    source.sub_type,
    source.type,
    obj && obj.success,
  ].map((value) => String(value == null ? "" : value)).join("");
}

function safeEqualHex(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left).toLowerCase(), "hex");
  const b = Buffer.from(String(right).toLowerCase(), "hex");
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function calculateHmac(payload, secret) {
  const obj = payload && payload.obj ? payload.obj : payload;
  return crypto.createHmac("sha512", secret).update(legacyHmacPayload(obj)).digest("hex");
}

function verifyHmac(payload, signature) {
  const secret = required("PAYMOB_HMAC_SECRET");
  return safeEqualHex(calculateHmac(payload, secret), signature);
}

function callbackDetails(payload) {
  const obj = payload && payload.obj ? payload.obj : payload;
  const order = obj && obj.order ? obj.order : {};
  const paymentKeyClaims = obj && obj.payment_key_claims ? obj.payment_key_claims : {};
  return {
    transactionId: obj && obj.id != null ? String(obj.id) : null,
    providerOrderId: order.id != null ? String(order.id) : null,
    merchantOrderId:
      order.merchant_order_id ||
      obj.merchant_order_id ||
      paymentKeyClaims.merchant_order_id ||
      null,
    amountCents: Number(obj && obj.amount_cents),
    currency: obj && obj.currency ? String(obj.currency) : null,
    success: Boolean(obj && obj.success),
    raw: payload,
  };
}

module.exports = { createCheckout, verifyHmac, callbackDetails, calculateHmac };
