/* =========================================================
   LMSProtect — روادع النسخ/التحميل/الطباعة أثناء المعاينة التجريبية فقط
   ⚠️ هذه روادع عملية (تمنع الغالبية) وليست حماية مطلقة —
   لا يوجد على الويب أي وسيلة تمنع تصوير الشاشة بشكل مضمون 100%.
   ========================================================= */
(function () {
  if (!window.LMSTrial) return;
  if (window.LMSAuth && window.LMSAuth.isLoggedIn()) return; // حساب كامل — مفيش قيود إطلاقًا
  const status = LMSTrial.getStatus();
  if (!status.started) return; // زائر عادي لسه ما بدأش معاينة — مفيش قيود

  const style = document.createElement("style");
  style.textContent = `
    body.trial-protected, body.trial-protected *{
      -webkit-user-select:none!important; -moz-user-select:none!important; user-select:none!important;
      -webkit-touch-callout:none!important;
    }
    body.trial-protected img{ -webkit-user-drag:none!important; pointer-events:none; }
    @media print{ body.trial-protected{ display:none!important; } }
    #trial-watermark-layer{
      position:fixed;inset:0;z-index:4000;pointer-events:none;overflow:hidden;
      display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:170px;
      transform:rotate(-24deg) scale(1.35);opacity:0.08;
    }
    #trial-watermark-layer span{
      display:flex;align-items:center;justify-content:center;
      font-family:'Tajawal',sans-serif;font-weight:800;font-size:0.78rem;
      color:#fff;white-space:nowrap;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("trial-protected");

    // Watermark overlay — traceability deterrent if content is leaked
    const layer = document.createElement("div");
    layer.id = "trial-watermark-layer";
    const label = (status.name || "زائر") + " • نسخة تجريبية • " + new Date().toLocaleDateString("ar-EG");
    for (let i = 0; i < 24; i++) {
      const s = document.createElement("span");
      s.textContent = label;
      layer.appendChild(s);
    }
    document.body.appendChild(layer);
  });

  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  document.addEventListener("copy", function (e) { e.preventDefault(); });
  document.addEventListener("cut", function (e) { e.preventDefault(); });

  document.addEventListener("keydown", function (e) {
    const k = e.key ? e.key.toLowerCase() : "";
    const blockedCombo = (e.ctrlKey || e.metaKey) && ["c", "x", "s", "p", "u"].includes(k);
    const blockedDevtools = e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && k === "i");
    if (blockedCombo || blockedDevtools) {
      e.preventDefault();
      if (window.LMSUi) LMSUi.showToast("غير مسموح بالنسخ أو الحفظ أثناء المعاينة التجريبية");
    }
  });

  // رادع خفيف: تمويه المحتوى عند تبديل النافذة (مؤشر محتمل على تسجيل الشاشة)
  document.addEventListener("visibilitychange", function () {
    document.body.style.filter = document.hidden ? "blur(20px)" : "";
  });
})();
