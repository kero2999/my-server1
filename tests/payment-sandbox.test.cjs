const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function load(file, mocks = {}, extras = {}) {
  const module = { exports: {} };
  const actual = require('node:module').createRequire(path.resolve(__dirname, '../src/', file));
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/', file), 'utf8'), { module, exports: module.exports, require: name => name in mocks ? mocks[name] : actual(name), Buffer, console, URL, Date, ...extras });
  return module.exports;
}
const env = { PAYMOB_SANDBOX_ENABLED: 'true', PAYMOB_TEST_API_KEY: 'test-key', PAYMOB_TEST_HMAC_SECRET: 'test-secret', PAYMOB_TEST_INTEGRATION_ID: '5851430', PAYMOB_TEST_IFRAME_ID: '1068624', PAYMOB_INTEGRATION_ID: '123', PAYMOB_API_KEY: 'live-key', PAYMOB_IFRAME_ID: '456', PAYMOB_HMAC_SECRET: 'live-secret' };
const paymob = load('paymob.js', {}, { process: { env } });
function fixture(changes = {}) {
  const row = { id: 'session', user_id: '7', amount_cents: 100, currency: 'EGP', integration_id: 5851430, status: 'pending' };
  const tables = [];
  const db = { from(table) { tables.push(table); let values, excluded; const q = { select() { return q; }, eq() { return q; }, neq(k,v) { excluded = v; return q; }, maybeSingle: async () => ({ data: row }), update(v) { values = v; return q; }, then(resolve) { if (row.status !== excluded) Object.assign(row, values); return Promise.resolve({}).then(resolve); } }; return q; } };
  const sandbox = load('paymob-sandbox.js', { './db': db, './paymob': paymob }, { process: { env: { ...env, ...changes } } });
  return { row, tables, sandbox };
}
function payload(changes = {}) { return { obj: { id: 9, order: { id: 8 }, amount_cents: 100, currency: 'EGP', integration_id: 5851430, success: true, pending: false, is_live: false, error_occured: false, is_refunded: false, is_voided: false, ...changes } }; }
function sign(p) { return paymob.calculateHmac(p, 'test-secret'); }
test('sandbox disabled and incomplete config fail closed', () => {
  for (const changes of [{ PAYMOB_SANDBOX_ENABLED: '' }, { PAYMOB_TEST_API_KEY: '' }, { PAYMOB_TEST_HMAC_SECRET: '' }, { PAYMOB_TEST_INTEGRATION_ID: 'bad' }, { PAYMOB_TEST_IFRAME_ID: '' }, { PAYMOB_INTEGRATION_ID: '5851430' }, { PAYMOB_WALLET_INTEGRATION_ID: '5851430' }]) assert.throws(() => fixture(changes).sandbox.sandboxConfig());
});
test('signed test success updates only the dedicated sandbox table, idempotently', async () => {
  const f = fixture(), p = payload();
  assert.equal((await f.sandbox.processSandboxCallback(p, sign(p))).code, 200);
  assert.equal(f.row.status, 'paid');
  const failed = payload({ success: false });
  await f.sandbox.processSandboxCallback(failed, sign(failed));
  assert.equal(f.row.status, 'paid');
  assert.deepEqual([...new Set(f.tables)], ['payment_sandbox_sessions']);
});
for (const [name, changes] of Object.entries({ live: { is_live: true }, missingLiveFlag: { is_live: undefined }, pending: { pending: true }, wrongIntegration: { integration_id: 123 }, wrongAmount: { amount_cents: 200 }, wrongCurrency: { currency: 'USD' }, missingTransaction: { id: undefined } })) test('rejects ' + name, async () => {
  const f = fixture(), p = payload(changes);
  assert.equal((await f.sandbox.processSandboxCallback(p, sign(p))).code, 400);
  assert.equal(f.row.status, 'pending');
});
test('wrong HMAC and tampered signed integration are rejected', async () => {
  const f = fixture(), p = payload(); const signature = sign(p);
  p.obj.integration_id = 99;
  assert.equal((await f.sandbox.processSandboxCallback(p, signature)).code, 400);
  assert.equal((await f.sandbox.processSandboxCallback(payload(), 'a'.repeat(128))).code, 400);
});
test('failed or voided provider transactions never become paid', async () => {
  for (const changes of [{ success: false }, { is_refunded: true }, { is_voided: true }, { error_occured: true }]) {
    const f = fixture(), p = payload(changes); await f.sandbox.processSandboxCallback(p, sign(p)); assert.equal(f.row.status, 'failed');
  }
});
for (const sandbox of [false, true]) test('checkout isolates credentials and origin; sandbox=' + sandbox, async () => {
  const calls = [];
  const service = load('paymob.js', { './paymob-sandbox': { sandboxConfig: () => fixture().sandbox.sandboxConfig() } }, { process: { env: { ...env, PAYMOB_API_BASE_URL: 'https://live-api.invalid' } }, fetch: async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ token: 'mock-token', id: 88 }) }; } });
  const result = await service.createCheckout({ amountCents: 100, currency: 'EGP', merchantOrderId: 'order', user: {}, sandbox });
  assert.equal(calls[0].body.api_key, sandbox ? 'test-key' : 'live-key');
  assert.equal(calls[2].body.integration_id, sandbox ? 5851430 : 123);
  assert.ok(calls.every(c => c.url.startsWith(sandbox ? 'https://accept.paymob.com/api/' : 'https://live-api.invalid/')));
  assert.ok(result.checkoutUrl.includes(sandbox ? '/1068624?' : '/456?'));
});

test('sandbox router installs server-side admin authorization before all routes', async () => {
  const entries = [], admin = () => {};
  const router = { use(...handlers) { entries.push(['use', ...handlers]); }, get(url, ...handlers) { entries.push(['get', url, ...handlers]); }, post(url, ...handlers) { entries.push(['post', url, ...handlers]); } };
  load('routes/payment-sandbox.js', { express: { Router: () => router }, '../db': {}, '../middleware/admin': { requireAdmin: admin }, '../middleware/rate-limit': { rateLimit: () => () => {} }, '../paymob': {}, '../paymob-sandbox': {} });
  assert.equal(entries[0][0], 'use'); assert.equal(entries[0][1], admin);
  assert.ok(entries.some(e => e[0] === 'post' && e[1] === '/create'));
});

test('real admin middleware rejects anonymous and student users; rechecks database role', async () => {
  for (const role of [null, 'student', 'admin']) {
    let reached = false;
    const { requireAdmin } = load('middleware/admin.js', { '../db': { from() { const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: { role } }) }; return q; } }, './auth': { authenticate: () => role === null ? null : 7 } });
    const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
    await requireAdmin({ headers: {} }, res, () => { reached = true; });
    assert.equal(reached, role === 'admin');
    if (role !== 'admin') assert.equal(res.code, role === null ? 401 : 403);
  }
});

