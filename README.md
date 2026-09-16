# منصة التسويق التعليمية — دليل سريع

## اللي جاهز وشغال دلوقتي (Frontend كامل)
- **تسجيل دخول / حساب جديد** — `index.html`
- **لوحة الطالب** — `dashboard.html` (تقدّم إجمالي، متابعة آخر درس، فهرس الفصول، بحث)
- **9 فصول** — `ch1.html` ... `ch9.html` (نفس تصميمك الأصلي + تتبع تلقائي للتقدّم)
- **اختبارات** — `quiz.html?ch=N` (45 سؤال، 5 لكل فصل، نجاح من 70%)
- **شهادة إتمام** — `certificate.html` (تُفتح تلقائيًا بعد اجتياز كل الفصول)
- **وضع ليلي/نهاري** — زر في كل صفحة، محفوظ بين الزيارات
- **بحث داخل الكورس** — يبحث في كل شرائح الفصول التسعة ويوديك للشريحة مباشرة
- **PWA + عمل بدون إنترنت** — `manifest.json` + `sw.js` (Service Worker) يخزّنوا كل الصفحات بعد أول زيارة

## 🤖 المرشد الذكي (AI Mentor) — شات + صوت
فقاعة عائمة في كل فصل وفي اللوحة، بتوفّر:
- شات نصي مع مرشد ذكي مطّلع على محتوى الفصل الحالي فعليًا
- تحدث صوتي (تسجيل السؤال بالصوت + سماع الرد) عبر Web Speech API المدمجة في المتصفح (مجانية، بدون أي تكلفة إضافية)
- أسلوب تدريس خطوة بخطوة، مش إجابات جاهزة على الاختبارات
- في نهاية كل فصل، المرشد بيطلب من الطالب مشروع تطبيقي قصير (معرّف في `server/src/mentor-projects.js`) لإثبات إنه فهم فعليًا، وبيقيّم إجابته

**متطلبات التفعيل:**
- يحتاج السيرفر الحقيقي شغال ومربوط (`js/config.js`)
- يحتاج `ANTHROPIC_API_KEY` في `.env` بتاع السيرفر (من [console.anthropic.com](https://console.anthropic.com/settings/keys))
- متاح فقط للمشتركين المسجّلين دخول (مش للمعاينة المجانية)

لو حبيت تغيّر شخصية المرشد أو أسلوبه، عدّل الدالة `buildSystemPrompt` في `server/src/routes/mentor.js`.

## 🆓 المعاينة المجانية (10 دقائق) + حماية المحتوى
من صفحة تسجيل الدخول، أي زائر يقدر يجرب المحتوى مجانًا 10 دقائق بدون تسجيل
كامل (زر "جرّب المحتوى مجانًا"). أثناء المعاينة:
- عداد تنازلي ظاهر في أعلى الشاشة، وقفل تلقائي + توجيه لصفحة `upgrade.html` عند الانتهاء
- المعاينة مرة واحدة فقط لكل متصفح (محفوظة في `localStorage`)
- منع تحديد/نسخ النص، الزر اليمين، اختصارات الحفظ/الطباعة/فتح أدوات المطوّر
- علامة مائية بإسم الزائر ووقت الدخول منتشرة فوق المحتوى
- تمويه المحتوى تلقائيًا عند تبديل النافذة (رادع بسيط)

**⚠️ مهم:** دي روادع عملية تمنع الغالبية العظمى من النسخ/التسريب، لكنها
**مش حماية مطلقة** — لا يوجد أي موقع يقدر يمنع تصوير الشاشة (Screenshot)
بشكل مضمون 100%، لأن المتصفحات مفيهاش صلاحية على مستوى نظام التشغيل لمنع كده.
العلامة المائية هي أقوى رادع عملي متاح فعلاً (لو حد صوّر ونشر، الصورة بتوريك مين).

لو حبيت تغيّر مدة المعاينة، غيّر قيمة `TRIAL_SECONDS` في `js/trial.js`.

## ⚠️ نظام الدخول — وضعان تلقائيان
الملف `js/config.js` هو مفتاح التحكم:
```js
const API_BASE_URL = null; // الوضع الحالي: محلي تجريبي
```
- **`null` (الوضع الحالي):** حسابات محلية في متصفح الطالب فقط، بدون تحقق دفع حقيقي — للتجربة والعرض.
- **رابط سيرفر حقيقي:** حسابات حقيقية بالإيميل + JWT، وحالة الاشتراك بتتحدّث تلقائيًا من Whop. راجع مجلد `server/` المرفق — فيه سيرفر Node.js جاهز بالكامل + دليل نشر خطوة بخطوة (`server/README.md`).

بمجرد ما تحط رابط السيرفر في `config.js`، المنصة كلها (تسجيل، دخول، حماية الصفحات، صفحة upgrade) بتشتغل بالوضع الحقيقي تلقائيًا بدون أي تعديل تاني.


## تطبيق أندرويد (APK / AAB)
أسهل طريقة لتحويل نفس الموقع لتطبيق أندرويد حقيقي هي **Capacitor**
(بيلف موقعك جوه WebView حقيقي + يديك APK/AAB قابل للنشر على Google Play).
راجع ملف `capacitor-setup.md` المرفق للخطوات كاملة (تتنفذ عندك محليًا لأنها محتاجة Android Studio).

## هيكل الملفات
```
platform/
├── index.html          (تسجيل الدخول)
├── dashboard.html       (لوحة الطالب)
├── ch1.html … ch9.html  (الفصول)
├── quiz.html            (الاختبارات)
├── certificate.html     (الشهادة)
├── manifest.json + sw.js (PWA / أوفلاين)
├── css/shared.css
├── js/
│   ├── auth.js          (تسجيل الدخول — Local Demo)
│   ├── theme.js          (الوضع الليلي)
│   ├── progress.js       (التقدّم وآخر درس)
│   ├── quiz-data.js      (بنك الأسئلة)
│   ├── search-data.js    (فهرس البحث)
│   ├── ui.js              (مساعدات واجهة)
│   └── sw-register.js
└── icons/
```


## Marketplace foundation

تمت إضافة أساس Marketplace بصورة additive، مع الحفاظ على مسارات المصادقة والمرشد الحالية:

- `supabase-marketplace-migration.sql` يضيف الجداول الخاصة بالتصنيفات والكورسات والإصدارات والـenrollments والمدفوعات والتجربة والتقدم والاختبارات والمشروعات والشهادات.
- `src/routes/courses.js` يوفّر Platform API موحدًا للكتالوج والوصول والتجربة والتقدم.
- `src/routes/payments.js` ينشئ Payment Pending اعتمادًا على السعر الموجود في قاعدة البيانات، ثم يطلب Checkout من Paymob.
- `src/routes/webhooks.js` يستقبل `POST /api/webhooks/paymob` ويتحقق من HMAC ثم ينشئ Enrollment idempotently بعد النجاح.
- `src/routes/admin.js` يوفّر API محميًا بدور `admin` لإدارة التصنيفات والكورسات ورفع ZIP ونشر الإصدارات.
- `src/paymob.js` يحتوي تكامل Paymob server-side؛ لا تضع أي مفاتيح Paymob في الفرونت إند.

### تشغيل الـMigration

شغّل `supabase-schema.sql` مرة واحدة على مشروع Supabase القديم، ثم شغّل `supabase-marketplace-migration.sql`. لا تحذف الجداول القديمة. يجب أيضًا إنشاء Storage bucket باسم قيمة `COURSE_FILES_BUCKET`، ويُفضّل أن يكون Private.

### إعداد Render

أضف في Render المتغيرات `COURSE_FILES_BUCKET`, `PAYMOB_API_BASE_URL`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, و`PAYMOB_HMAC_SECRET`، إضافة إلى متغيرات Supabase و`JWT_SECRET` و`FRONTEND_URL`. الكود الحالي يستخدم `OPENAI_API_KEY` و`BREVO_API_KEY` للوظائف الموجودة، وليس `ANTHROPIC_API_KEY` أو `RESEND_API_KEY`.

### المسارات الجديدة

```text
GET    /api/courses
GET    /api/courses/:courseId
GET    /api/courses/:courseId/access
POST   /api/courses/:courseId/trial/start
GET    /api/courses/:courseId/progress
PUT    /api/courses/:courseId/progress
POST   /api/courses/:courseId/lessons/:lessonKey/complete
POST   /api/payments/course/:courseId/create
POST   /api/webhooks/paymob
GET    /api/admin/categories
POST   /api/admin/categories
GET    /api/admin/courses
POST   /api/admin/courses
PATCH  /api/admin/courses/:courseId
POST   /api/admin/courses/:courseId/upload-zip
POST   /api/admin/courses/:courseId/publish
```

### ملاحظات مهمة

الواجهة الحالية أضيف إليها `courses.html` و`course.html` و`admin.html` و`js/platform-api.js`. هذه الصفحات تحتاج إلى تشغيل Migration ووجود كورس منشور في جدول `courses` حتى تظهر بيانات فعلية. صفحة تفاصيل الكورس لا تفتح ملفات ZIP بعد؛ خطوة Course Player وتوقيع روابط الملفات ستأتي بعد تثبيت Storage وطريقة استخراج ZIP في بيئة Render.

يجب اختبار Paymob أولًا في Sandbox. لا تعتبر redirect أو صفحة success دليلًا على الدفع؛ تفعيل الـEnrollment يجب أن يحدث فقط داخل Webhook الموثق بـHMAC بعد مطابقة `provider_order_id`, `amount_cents`, و`currency`.
