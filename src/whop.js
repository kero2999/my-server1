/* عميل Whop SDK — يُستخدم للتحقق من صحة الـ webhooks القادمة من Whop */
const { Whop } = require("@whop/sdk");

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY,
  webhookKey: Buffer.from(process.env.WHOP_WEBHOOK_SECRET || "").toString("base64"),
});

module.exports = whopsdk;
