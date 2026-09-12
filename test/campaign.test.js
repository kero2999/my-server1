const assert = require("node:assert/strict");
const test = require("node:test");
const { campaignExpiry, campaignTrialStatus } = require("../src/campaign-service");

test("campaign expiry is calculated from the server-side start time", () => {
  assert.equal(
    campaignExpiry("2026-08-26T00:00:00.000Z", 10),
    "2026-09-05T00:00:00.000Z"
  );
});

test("campaign trial is active only while its expiry is in the future", () => {
  const trial = {
    id: 7,
    campaign_key: "marketing-launch-10-day",
    payment_id: 8,
    duration_days: 10,
    status: "active",
    started_at: "2026-08-26T00:00:00.000Z",
    expires_at: "2026-09-05T00:00:00.000Z",
  };
  assert.equal(campaignTrialStatus(trial, Date.parse("2026-08-30T00:00:00.000Z")).active, true);
  assert.equal(campaignTrialStatus(trial, Date.parse("2026-09-06T00:00:00.000Z")).active, false);
  assert.equal(campaignTrialStatus({ ...trial, status: "revoked" }, Date.parse("2026-08-30T00:00:00.000Z")).active, false);
});
