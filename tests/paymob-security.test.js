const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { calculateHmac, verifyHmac, callbackDetails } = require("../src/paymob");

const payload = { obj: {
  id: 123, amount_cents: 39900, currency: "EGP", success: true,
  order: { id: 456, merchant_order_id: "ql_test_123" },
  source_data: { pan: "****", sub_type: "card", type: "card" }
} };

test("valid signed Paymob callback is accepted", () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  try {
    process.env.PAYMOB_HMAC_SECRET = "test-secret-not-for-production";
    const signature = calculateHmac(payload, process.env.PAYMOB_HMAC_SECRET);
    assert.equal(verifyHmac(payload, signature), true);
    assert.equal(callbackDetails(payload).providerOrderId, "456");
    assert.equal(callbackDetails(payload).merchantOrderId, "ql_test_123");
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});

test("tampered amount is rejected by signature validation", () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  try {
    process.env.PAYMOB_HMAC_SECRET = "test-secret-not-for-production";
    const signature = calculateHmac(payload, process.env.PAYMOB_HMAC_SECRET);
    const tampered = JSON.parse(JSON.stringify(payload));
    tampered.obj.amount_cents = 100;
    assert.equal(verifyHmac(tampered, signature), false);
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});

test("malformed signature is rejected", () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  try {
    process.env.PAYMOB_HMAC_SECRET = "test-secret-not-for-production";
    assert.equal(verifyHmac(payload, "not-hex"), false);
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});
