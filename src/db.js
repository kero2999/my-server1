/* الاتصال بقاعدة بيانات Supabase — يستخدم service_role key
   (وصول كامل موثوق من السيرفر فقط، لا يُستخدم أبدًا في كود الواجهة الأمامية) */
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn("⚠️  SUPABASE_URL أو SUPABASE_SERVICE_KEY غير مضبوطين في .env");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
