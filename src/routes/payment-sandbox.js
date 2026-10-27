const express = require('express');
const crypto = require('crypto');
const supabase = require('../db');
const { requireAdmin } = require('../middleware/admin');
const { rateLimit } = require('../middleware/rate-limit');
const { createCheckout } = require('../paymob');
const { sandboxConfig } = require('../paymob-sandbox');
const router = express.Router();
const limiter = rateLimit({ name: 'paymob-sandbox', windowMs: 600000, max: 5, keyGenerator: req => String(req.userId) });
router.use(requireAdmin);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

router.get('/config', async (req, res) => {
  try {
    const config = sandboxConfig();
    const { error } = await supabase.from('payment_sandbox_sessions').select('id').limit(1);
    if (error) throw Error('SANDBOX_TABLE_NOT_READY');
    res.json({ ok: true, sandbox: true, integrationId: config.integrationId, iframeId: config.iframeId, amountCents: 100, currency: 'EGP' });
  } catch (e) { res.status(503).json({ ok: false, error: 'وضع الاختبار غير جاهز. راجع إعداداته وجدول الاختبار.', code: e.message.startsWith('SANDBOX_') ? e.message : 'SANDBOX_UNAVAILABLE' }); }
});

router.post('/create', limiter, async (req, res) => {
  let id;
  try {
    const config = sandboxConfig();
    const { data: user, error: userError } = await supabase.from('users').select('email, full_name').eq('id', req.userId).maybeSingle();
    if (userError || !user) throw Error('SANDBOX_USER_UNAVAILABLE');
    id = crypto.randomUUID();
    const merchantOrderId = 'ql_sandbox_' + id;
    const { error } = await supabase.from('payment_sandbox_sessions').insert({ id, user_id: String(req.userId), merchant_order_id: merchantOrderId, amount_cents: 100, currency: 'EGP', integration_id: config.integrationId, status: 'pending' });
    if (error) throw error;
    const checkout = await createCheckout({ amountCents: 100, currency: 'EGP', merchantOrderId, user: { email: user.email, fullName: user.full_name }, sandbox: true });
    const { error: updateError } = await supabase.from('payment_sandbox_sessions').update({ provider_order_id: checkout.providerOrderId }).eq('id', id);
    if (updateError) throw updateError;
    res.status(201).json({ ok: true, sandbox: true, sessionId: id, checkoutUrl: checkout.checkoutUrl });
  } catch (e) {
    if (id) await supabase.from('payment_sandbox_sessions').update({ status: 'failed' }).eq('id', id).eq('status', 'pending');
    res.status(503).json({ ok: false, error: 'تعذّر إنشاء جلسة الاختبار. راجع إعدادات TEST ثم أعد المحاولة.' });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id)) return res.status(400).json({ ok: false, error: 'معرّف غير صالح.' });
  const { data, error } = await supabase.from('payment_sandbox_sessions').select('id, status, provider_transaction_id, updated_at').eq('id', req.params.id).eq('user_id', String(req.userId)).maybeSingle();
  if (error) return res.status(503).json({ ok: false, error: 'تعذّر قراءة حالة الاختبار.' });
  if (!data) return res.status(404).json({ ok: false, error: 'جلسة الاختبار غير موجودة.' });
  res.json({ ok: true, sandbox: true, session: data });
  } catch (_) { res.status(503).json({ ok: false, error: 'تعذّر قراءة حالة الاختبار.' }); }
});
module.exports = router;
