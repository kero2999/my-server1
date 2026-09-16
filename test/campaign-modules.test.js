const test = require("node:test");
const assert = require("node:assert/strict");

test("campaign modules load with the existing Express stack", () => {
  assert.ok(require("../src/campaign-service"));
  assert.ok(require("../src/routes/campaigns"));
  assert.ok(require("../src/routes/courses"));
  assert.ok(require("../src/routes/payments"));
  assert.ok(require("../src/routes/reviews"));
  assert.ok(require("../src/routes/webhooks"));
});
