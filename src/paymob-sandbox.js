const crypto = require('crypto');
const supabase = require('./db');
const { calculateHmac, callbackDetails } = require('./paymob');

function sandboxConfig() {
  if (process.env.PAYMOB_SANDBOX_ENABLED !== 'true') throw Error('SANDBOX_DISABLED');
  const apiKey = process.env.PAYMOB_TEST_API_KEY;
  const secret = process.env.PAYMOB_TEST_HMAC_SECRET;
  const integrationId = process.env.PAYMOB_TEST_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_TEST_IFRAME_ID;
  if (!apiKey || !secret || !/^\d+$/.test(integrationId || '') || !/^\d+$/.test(iframeId || '')) throw Error('SANDBOX_NOT_CONFIGURED');
  if (Number(integrationId) === Number(process.env.PAYMOB_INTEGRATION_ID) || Number(integrationId) === Number(process.env.PAYMOB_WALLET_INTEGRATION_ID)) throw Error('SANDBOX_LIVE_INTEGRATION');
  return { apiKey, secret, integrationId: Number(integrationId), iframeId };
}

function verifySandboxCallback(payload, signature, integrationId, secret) {
  const obj = payload && payload.obj ? payload.obj : payload;
  // HMAC covers integration_id. Never accept live or pending transactions here.
  if (!obj || obj.is_live !== false || Number(obj.integration_id) !== integrationId || obj.pending !== false) return false;
  if (!/^[a-fA-F0-9]{128}$/.test(String(signature || ''))) return false;
  const expected = calculateHmac(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

async function processSandboxCallback(payload, signature) {
  const config = sandboxConfig();
  if (!verifySandboxCallback(payload, signature, config.integrationId, config.secret)) return { code: 400, error: 'Invalid sandbox callback' };
  const details = callbackDetails(payload);
  if (!details.providerOrderId || !details.transactionId) return { code: 400, error: 'Incomplete callback' };
  const { data: session, error } = await supabase.from('payment_sandbox_sessions').select('*').eq('provider_order_id', details.providerOrderId).maybeSingle();
  if (error) throw error;
  if (!session) return { code: 404, error: 'Sandbox session not found' };
  if (session.integration_id !== config.integrationId || session.amount_cents !== details.amountCents || details.currency !== 'EGP') return { code: 400, error: 'Sandbox payment mismatch' };
  const obj = payload.obj || payload;
  const success = obj.success === true && obj.error_occured === false && obj.is_refunded === false && obj.is_voided === false;
  if (session.status !== 'paid') {
    const { error: updateError } = await supabase.from('payment_sandbox_sessions').update({
      status: success ? 'paid' : 'failed', provider_transaction_id: details.transactionId,
      updated_at: new Date().toISOString(),
    }).eq('id', session.id).neq('status', 'paid');
    if (updateError) throw updateError;
  }
  // Deliberately no enrollment, affiliate, production payment or Purchase event.
  return { code: 200, received: true, sandbox: true };
}

module.exports = { sandboxConfig, verifySandboxCallback, processSandboxCallback };
