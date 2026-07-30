# تحويل المنصة لتطبيق أندرويد (APK / AAB) عبر Capacitor

هذه الخطوات تُنفَّذ على جهازك (تحتاج Node.js + Android Studio مثبّتين)،
لأن بناء APK/AAB حقيقي يحتاج Android SDK وGradle وهي أدوات غير متاحة
داخل بيئة المحادثة هنا.

## 1. تجهيز المشروع
```bash
npm install -g @capacitor/cli
mkdir marketing-app && cd marketing-app
npm init -y
npm install @capacitor/core @capacitor/android
npx cap init "منصة التسويق" "com.ounai.marketingapp" --web-dir=www
```

## 2. انسخ ملفات الموقع
انسخ كل محتويات مجلد `platform/` (اللي جهزته لك) داخل مجلد `www/` في مشروع Capacitor الجديد.

## 3. أضف منصة أندرويد
```bash
npx cap add android
npx cap copy
npx cap open android
```
هيفتح المشروع في **Android Studio** مباشرة.

## 4. بناء APK (للتجربة)
داخل Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
هتلاقي الملف في: `android/app/build/outputs/apk/debug/app-debug.apk`

## 5. بناء AAB (للنشر على Google Play)
1. أنشئ مفتاح توقيع (Signing Key):
```bash
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias marketing-app
```
2. في Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**
3. اختر الـ keystore اللي عملته، واملأ البيانات، واختر **release**.
4. الملف الناتج (`app-release.aab`) هو اللي بترفعه على Google Play Console.

## ملاحظات مهمة
- **العمل بدون إنترنت**: الـ Service Worker (`sw.js`) هيشتغل جوه WebView بتاع Capacitor بنفس الطريقة، فالتطبيق هيدعم الأوفلاين تلقائيًا.
- **تسجيل الدخول الحقيقي + Whop**: لازم يكون جاهز *قبل* بناء نسخة النشر النهائية (راجع `README.md`)، لأن أي تحديث بعد كده في المنطق يحتاج رفع نسخة جديدة على المتجر.
- **الأيقونات والسبلاش سكرين**: استخدم أداة `npx @capacitor/assets generate` لتوليدها تلقائيًا من شعارك.
- بدلاً من Capacitor، لو حبيت تجربة أقرب لتطبيق React Native حقيقي (أداء أعلى شوية)، ممكن نتكلم عن ده في محادثة تانية مخصّصة لبناء التطبيق.
