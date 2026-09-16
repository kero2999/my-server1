/* عميل Whop SDK — اختياري أثناء الانتقال إلى Paymob */
const { Whop } = require("@whop/sdk");

let whopsdk = null;
if (process.env.WHOP_API_KEY) {
  whopsdk = new Whop({
    apiKey: process.env.WHOP_API_KEY,
    webhookKey: Buffer.from(process.env.WHOP_WEBHOOK_SECRET || "").toString("base64"),
  });
}

module.exports = whopsdk;
