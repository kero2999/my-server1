const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateHmac, verifyHmac, callbackDetails } = require("../src/paymob");

const payload = {
  type: "TRANSACTION",
  obj: {
    id: 12345,
    amount_cents: 25000,
    created_at: "2026-08-21T10:00:00.000000",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    integration_id: 987,
    is_3d_secure: true,
    is_auth: false,
    is_capture: true,
    is_refunded: false,
    is_standalone_payment: false,
    order: { id: 45678, merchant_order_id: "ql_1_10_test" },
    owner: 22,
    pending: false,
    source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
    success: true,
  },
};

test("Paymob callback details are normalized", () => {
  assert.deepEqual(callbackDetails(payload), {
    transactionId: "12345",
    providerOrderId: "45678",
    merchantOrderId: "ql_1_10_test",
    amountCents: 25000,
    currency: "EGP",
    success: true,
    raw: payload,
  });
});

test("Paymob HMAC accepts the correct signature and rejects a changed one", () => {
  const secret = "test-paymob-secret";
  const signature = calculateHmac(payload, secret);
  process.env.PAYMOB_HMAC_SECRET = secret;
  assert.equal(verifyHmac(payload, signature), true);
  assert.equal(verifyHmac(payload, signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0")), false);
});
