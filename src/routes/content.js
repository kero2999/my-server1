const express = require("express");
const jwt = require("jsonwebtoken");
const mime = require("mime-types");
const supabase = require("../db");
const { authenticate } = require("../middleware/auth");
const { findPublishedCourse, getAccess, resolveEntryFile } = require("./courses");
const { isChapterUnlocked } = require("../learning");
const { getUserCountry, getCourseVariants } = require("../country-service");
const { injectContentDialect, rewriteHtmlTextNodes } = require("../content-dialect");
const { publicHowToMake } = require("../chapter-templates");

const router = express.Router();
const PUBLIC_MENTOR_IMAGE = "https://www.quadralevel.com/images/mentor-avatar.jpeg";
const PRESERVE_UPLOADED_COURSE_SLUGS = new Set([
  "marketing-launch",
  "marketing-growth",
  "marketing-mastery",
  "marketing-leadership",
]);

function shouldPreserveUploadedCourse(courseSlug) {
  return PRESERVE_UPLOADED_COURSE_SLUGS.has(String(courseSlug || "").trim().toLowerCase());
}

function courseIdentifier(courseSlug, courseId) {
  return String(courseSlug || courseId || "").trim();
}

function courseDashboardUrl(courseSlug, courseId) {
  const identifier = courseIdentifier(courseSlug, courseId);
  return identifier ? `https://www.quadralevel.com/dashboard/${encodeURIComponent(identifier)}` : "https://www.quadralevel.com/courses";
}

function courseQuizUrl(courseSlug, courseId, chapterNumber) {
  const identifier = courseIdentifier(courseSlug, courseId);
  const chapter = Math.max(1, Number(chapterNumber) || 1);
  return identifier ? `https://www.quadralevel.com/quiz/${encodeURIComponent(identifier)}/chapter/${chapter}` : "https://www.quadralevel.com/courses";
}

function courseChapterImageUrl(courseSlug, chapterNumber) {
  const slug = String(courseSlug || "").trim().toLowerCase();
  const chapter = Math.max(1, Number(chapterNumber) || 1);
  if (!/^(marketing-launch|marketing-growth)$/.test(slug) || chapter > 9) return "";
  const assetPrefix = slug === "marketing-launch" ? "launch" : "growth";
  return `https://www.quadralevel.com/images/course-chapters/${assetPrefix}-ch${chapter}.webp`;
}

function safeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:$/.test(part))) return null;
  return parts.join("/");
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function renderHowToMakeSection(courseSlug, chapterNumber) {
  const howToMake = publicHowToMake(courseSlug, chapterNumber);
  if (!howToMake) return "";
  const iconFor = (type) => ({ "product-card": "fa-box-open", "result-card": "fa-flag-checkered", "process-card": "fa-diagram-project" }[type] || "fa-lightbulb");
  const stepSlides = howToMake.steps.map((step) => `<article class="ql-how-slide" data-slide-index="${step.number}"><div class="ql-how-slide-top"><span class="ql-how-step-no">STEP ${String(step.number).padStart(2, "0")}</span><span class="ql-how-visual-label"><i class="fas ${iconFor(step.visualType)}"></i> تطبيق المسوق</span></div><h3>${escapeHtml(step.title)}</h3><p class="ql-how-explain"><strong>ماذا فعل المحترف؟</strong> ${escapeHtml(step.what)}</p><div class="ql-how-example-card"><div class="ql-how-card-label">الإجابة التي كتبها المسوق في المشروع</div><div class="ql-how-card-value">${escapeHtml(step.filledValue)}</div></div><p class="ql-how-why"><strong>كيف وصلنا للقرار؟</strong> ${escapeHtml(step.explanation)}</p><p class="ql-how-why"><strong>لماذا هذه الخطوة؟</strong> ${escapeHtml(step.why)}</p></article>`).join("");
  const summary = howToMake.steps.map((step) => `<div class="ql-how-summary-item"><span>${String(step.number).padStart(2, "0")}</span><b>${escapeHtml(step.title)}</b></div>`).join("");
  const total = howToMake.steps.length + 2;
  const script = `<script>(function(){var root=document.getElementById("ql-how-to-make");if(!root)return;var slides=[].slice.call(root.querySelectorAll("[data-slide-index]")),intro=root.querySelector("[data-slide-intro]"),summary=root.querySelector("[data-slide-summary]"),all=[intro].concat(slides,[summary]),i=0,indicator=root.querySelector("[data-slide-indicator]"),show=function(n){i=(n+all.length)%all.length;all.forEach(function(x,k){if(x)x.hidden=k!==i;});if(indicator)indicator.textContent=String(i+1).padStart(2,"0")+" / "+String(all.length).padStart(2,"0");};root.querySelector("[data-slide-prev]").onclick=function(){show(i-1)};root.querySelector("[data-slide-next]").onclick=function(){show(i+1)};show(0);})();</script>`;
  return `<style id="ql-how-to-make-style">.ql-how-to-make{width:min(1120px,calc(100% - 32px));margin:42px auto 120px;padding:30px;border:1px solid rgba(201,168,106,.42);border-radius:24px;background:linear-gradient(135deg,#24170f 0%,#090909 100%);color:inherit;box-shadow:0 22px 52px rgba(0,0,0,.25);font-family:inherit}.ql-how-header{display:flex;align-items:center;gap:14px;margin-bottom:18px}.ql-how-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#c9a86a,#7a5230);color:#17100c;font-size:1.35rem}.ql-how-to-make h2{margin:0;color:#f0d79a;font-size:clamp(1.25rem,2.4vw,1.9rem)}.ql-how-subtitle{margin:3px 0 0;font-size:1.05rem;font-weight:800}.ql-how-intro,.ql-how-result{line-height:2;color:rgba(255,255,255,.86)}.ql-how-deck{margin-top:20px;min-height:370px}.ql-how-slide,.ql-how-intro-slide,.ql-how-summary-slide{padding:24px;border:1px solid rgba(201,168,106,.3);border-radius:18px;background:linear-gradient(145deg,rgba(201,168,106,.13),rgba(10,10,10,.5));animation:qlHowIn .35s ease both}.ql-how-slide[hidden],.ql-how-intro-slide[hidden],.ql-how-summary-slide[hidden]{display:none}.ql-how-slide-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.ql-how-step-no,.ql-how-visual-label{color:#c9a86a;font-size:.78rem;font-weight:900}.ql-how-visual-label{color:#8fcdbb}.ql-how-slide h3{margin:0 0 15px;color:#f0d79a;font-size:1.3rem}.ql-how-explain,.ql-how-why{line-height:2;color:rgba(255,255,255,.84)}.ql-how-example-card{margin:18px 0;padding:16px;border:1px solid rgba(63,143,125,.5);border-radius:14px;background:linear-gradient(135deg,rgba(63,143,125,.18),rgba(10,10,10,.25))}.ql-how-card-label{color:#8fcdbb;font-size:.76rem;font-weight:900;margin-bottom:7px}.ql-how-card-value{color:#fff;font-size:1.05rem;line-height:2}.ql-how-project{margin:14px 0;padding:15px;border-radius:15px;background:rgba(124,77,255,.12);border-inline-start:4px solid #7c4dff}.ql-how-project h3{margin:0 0 8px;color:#fff;font-size:1.12rem}.ql-how-project p{margin:8px 0;line-height:2;color:rgba(255,255,255,.82)}.ql-how-goal{color:#f0d79a!important;font-weight:800}.ql-how-plain-guide{margin:14px 0;padding:13px 15px;border-radius:12px;background:rgba(201,168,106,.08);border:1px solid rgba(201,168,106,.22);line-height:2;color:#f0d79a}.ql-how-summary-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:9px;margin:20px 0}.ql-how-summary-item{padding:13px 9px;border:1px solid rgba(201,168,106,.26);border-radius:13px;text-align:center;background:rgba(10,10,10,.35)}.ql-how-summary-item span{display:block;color:#c9a86a;font-weight:900}.ql-how-summary-item b{display:block;margin-top:5px;color:#fff;font-size:.86rem;line-height:1.5}.ql-how-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px}.ql-how-controls button{border:1px solid #c9a86a;background:rgba(201,168,106,.1);color:#f0d79a;border-radius:999px;padding:9px 16px;font:700 13px Tajawal,sans-serif;cursor:pointer;transition:.2s}.ql-how-controls button:hover{background:#c9a86a;color:#17110c;transform:translateY(-2px)}.ql-how-indicator{min-width:62px;text-align:center;color:#c9a86a;font-weight:900}.ql-how-finish{margin-top:16px;padding:13px;border-radius:12px;background:rgba(63,143,125,.12);border:1px solid rgba(63,143,125,.35);color:#c9e8df;text-align:center;font-weight:800}@keyframes qlHowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(max-width:640px){.ql-how-to-make{width:calc(100% - 20px);padding:18px}.ql-how-deck{min-height:470px}.ql-how-slide,.ql-how-intro-slide,.ql-how-summary-slide{padding:17px}}</style><section id="ql-how-to-make" class="ql-how-to-make" dir="rtl"><div class="ql-how-header"><div class="ql-how-icon"><i class="fas fa-person-chalkboard"></i></div><div><h2>🛠️ ${escapeHtml(howToMake.title)}</h2><p class="ql-how-subtitle">${escapeHtml(howToMake.subtitle)}</p></div></div><p class="ql-how-intro">تعال نشوف إزاي نطبق اللي اتعلمناه عمليًا. هنا المدرّس ينفذ المثال أمامك، وأنت تلاحظ طريقة التفكير خطوة بخطوة.</p><div class="ql-how-deck"><article class="ql-how-intro-slide" data-slide-intro><h3>ماذا سنصنع؟</h3><div class="ql-how-project"><h3><i class="fas fa-store"></i> المشروع المقترح: ${escapeHtml(howToMake.caseTitle)}</h3><p><strong>المثال الحقيقي:</strong> ${escapeHtml(howToMake.realExample)}</p><p>${escapeHtml(howToMake.caseDescription)}</p><p class="ql-how-goal"><i class="fas fa-bullseye"></i> ${escapeHtml(howToMake.projectGoal)}</p></div><p class="ql-how-plain-guide"><strong>الفكرة ببساطة:</strong> سنأخذ هذه الحالة، نحدد أهم المعلومات، ثم نستخدمها لبناء قرار تسويقي واضح يمكن تنفيذه.</p><p class="ql-how-explain"><strong>ماذا ستتعلم؟</strong> ستشاهد كيف ننتقل من الحالة الواقعية إلى قرار تسويقي مكتمل، خطوة بخطوة، من غير ما نطلب منك تنفيذ أي شيء هنا.</p></article>${stepSlides}<article class="ql-how-summary-slide" data-slide-summary><h3>ماذا فعلنا؟</h3><div class="ql-how-summary-flow">${summary}</div><p class="ql-how-explain">${escapeHtml(howToMake.explanation)}</p><p class="ql-how-finish">انتهى الشرح العملي. الآن يمكنك استخدام Template الفصل لتطبيق الفكرة على مشروعك.</p></article></div><div class="ql-how-controls"><button type="button" data-slide-prev>← السابق</button><span class="ql-how-indicator" data-slide-indicator>01 / ${String(total).padStart(2, "0")}</span><button type="button" data-slide-next>التالي →</button></div></section>${script}`;
}

function prepareCourseHtml(buffer, requestedPath = "", courseSlug = "", courseId = "", country = null) {
  const html = buffer.toString("utf8");
  // The outer Marketplace gateway has already authenticated this request.
  // Disable the legacy bundle's origin-local auth redirect inside the iframe.
  let sanitized = html
    .replace(/(<html\b[^>]*?)\sdata-protected=(['"])true\2/i, '$1 data-protected="false"')
    .replace(/<script\b[^>]*\bsw-register\.js[^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*\bsrc=(['"])[^'"]*auth\.js\1[^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?lms_session_v1[\s\S]*?<\/script>/gi, '')
    // Older published responses may already contain our injected dialect/context blocks.
    // Remove only those marked artifacts; never rewrite the uploaded text nodes.
    .replace(/<script\b[^>]*id=(['"])ql-country-dialect\1[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<aside\b[^>]*id=(['"])ql-country-context\1[^>]*>[\s\S]*?<\/aside>/gi, '');

  const chapterMatch = String(requestedPath || "").match(/(?:^|\/)ch(\d+)\.html$/i);
  const chapterNumber = chapterMatch ? Number(chapterMatch[1]) : /(?:^|\/)index\.html$/i.test(String(requestedPath || "")) ? 1 : 0;
  const isChapter = chapterNumber > 0;
  const uiMessages = country?.uiMessages || {};
  const hideGenericCountryExamples = ["marketing-mastery", "marketing-leadership"].includes(
    String(courseSlug || "").trim().toLowerCase()
  );
  const lessonContext = hideGenericCountryExamples ? "" : country?.lessonContexts?.[chapterNumber] || "";
  const countryBootstrap = country ? '<script id="ql-country-bootstrap">(function(){var profile=' + JSON.stringify({ countryCode: country.countryCode, countryName: country.countryName, dialect: country.dialect, currency: country.currency, currencySymbol: country.currencySymbol, locale: country.locale }) + ';window.LMSCountry=window.LMSCountry||{};window.LMSCountry.getCode=function(){return profile.countryCode;};window.LMSCountry.getProfile=function(){return profile;};})();</script>' : "";
  if (countryBootstrap && !/id=(['"])ql-country-bootstrap\1/i.test(sanitized)) sanitized = sanitized.replace(/<\/head>/i, countryBootstrap + '</head>');
  if (isChapter) {
    const dashboardUrl = courseDashboardUrl(courseSlug, courseId);
    const quizUrl = courseQuizUrl(courseSlug, courseId, chapterNumber);
    const chapterImageUrl = courseChapterImageUrl(courseSlug, chapterNumber);
    sanitized = sanitized
      .replace(/<a(\b[^>]*?)href=(['"])(?:\.\.\/|\.\/)*dashboard\.html(?:\?[^'"]*)?\2/gi, '<a$1href="' + dashboardUrl + '" target="_top"')
      .replace(/<a(\b[^>]*?)href=(['"])(?:\.\.\/|\.\/)*quiz\.html(?:\?[^'"]*)?\2/gi, '<a$1href="' + quizUrl + '" target="_top"')
      .replace(/location\.replace\(\s*(['"])(?:\.\.\/|\.\/)*dashboard\.html(?:\?[^'"]*)?\1\s*\)/gi, 'location.replace("' + dashboardUrl + '")')
      .replace(/location\.replace\(\s*(['"])(?:\.\.\/|\.\/)*quiz\.html(?:\?[^'"]*)?\1\s*\)/gi, 'location.replace("' + quizUrl + '")');
    if (chapterImageUrl && !/id=(['"])ql-chapter-visual\1/i.test(sanitized)) {
      const chapterVisualStyle = '<style id="ql-chapter-visual-style">.ql-chapter-visual{width:min(1120px,calc(100% - 32px));margin:28px auto 30px;border:1px solid rgba(201,168,106,.34);border-radius:24px;overflow:hidden;background:#0b1c31;box-shadow:0 18px 42px rgba(0,0,0,.18)}.ql-chapter-visual img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.ql-chapter-visual figcaption{padding:8px 16px;color:rgba(255,255,255,.7);font:500 12px/1.7 Tajawal,sans-serif;text-align:center}@media(max-width:640px){.ql-chapter-visual{width:calc(100% - 20px);margin:18px auto 24px;border-radius:16px}.ql-chapter-visual figcaption{padding:6px 10px;font-size:11px}}</style>';
      const chapterVisual = '<figure id="ql-chapter-visual" class="ql-chapter-visual"><img src="' + chapterImageUrl + '" alt="صورة توضيحية لموضوع الفصل" loading="eager" decoding="async" fetchpriority="high"><figcaption>صورة توضيحية لموضوع الفصل</figcaption></figure>';
      sanitized = sanitized.replace(/<\/head>/i, chapterVisualStyle + '</head>');
      sanitized = sanitized.replace(/<body\b[^>]*>/i, '$&' + chapterVisual);
    }
    if (lessonContext && !/id=(['"])ql-country-context\1/i.test(sanitized)) {
      const contextStyle = '<style id="ql-country-context-style">.ql-country-context{width:min(1120px,calc(100% - 32px));margin:18px auto;padding:12px 16px;border-inline-start:4px solid #c9a86a;border-radius:12px;background:rgba(201,168,106,.1);color:rgba(255,255,255,.8);font:500 13px/1.8 Tajawal,sans-serif}@media(max-width:640px){.ql-country-context{width:calc(100% - 20px);font-size:12px}}</style>';
      const contextBlock = '<aside id="ql-country-context" class="ql-country-context"><strong>' + escapeHtml(uiMessages.marketLabel || "مثال من السوق المحلي") + ':</strong> ' + escapeHtml(lessonContext) + '</aside>';
      sanitized = sanitized.replace(/<\/head>/i, contextStyle + '</head>').replace(/<body\b[^>]*>/i, '$&' + contextBlock);
    }
    const hasChapterNavigation = /class=(['"])[^>]*\bsite-floatnav\b[^>]*\1/i.test(sanitized);
    if (!hasChapterNavigation) {
      const chapterNavStyle = '<style id="chapter-nav-style">.site-floatnav{position:fixed;bottom:22px;left:22px;z-index:2000;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:90vw}.site-floatnav a{display:flex;align-items:center;gap:8px;background:rgba(11,11,12,.92);backdrop-filter:blur(10px);border:2px solid #c9a86a;color:#c9a86a;padding:10px 16px;border-radius:25px;font-family:Tajawal,sans-serif;font-weight:700;font-size:.85rem;text-decoration:none;transition:all .3s}.site-floatnav a:hover{background:#c9a86a;color:#0b0b0c;transform:translateY(-3px)}.site-floatnav a.quiz-link{border-color:#3f8f7d;color:#3f8f7d}.site-floatnav a.quiz-link:hover{background:#3f8f7d;color:#0b0b0c}@media(max-width:640px){.site-floatnav{left:10px;bottom:10px;gap:6px}.site-floatnav a{padding:8px 10px;font-size:.75rem}.site-floatnav a span.label{display:none}}</style>';
      const chapterNav = '<nav class="site-floatnav" aria-label="تنقل الكورس"><a href="' + dashboardUrl + '" target="_top"><i class="fas fa-house"></i><span class="label">' + escapeHtml(uiMessages.dashboard || "لوحتي") + '</span></a><a class="quiz-link" href="' + quizUrl + '" target="_top"><i class="fas fa-clipboard-check"></i><span class="label">' + escapeHtml(uiMessages.quiz || "الاختبار") + '</span></a></nav>';
      sanitized = sanitized.replace(/<\/head>/i, chapterNavStyle + '</head>');
      sanitized = sanitized.replace(/<body\b[^>]*>/i, '$&' + chapterNav);
    }
    const hasChapterMentorAccess = /mentor-top-btn|mentor-topbar/i.test(sanitized);
    if (!hasChapterMentorAccess) {
      const mentorTopbar = '<div class="mentor-topbar"><img src="' + PUBLIC_MENTOR_IMAGE + '" alt="Kero Mentor"><div><strong>Kero Mentor</strong><span>' + escapeHtml(uiMessages.mentorContext || "اسأل عن هذا الفصل") + '</span></div><button type="button" onclick="openChapterMentor()"><i class="fas fa-comments"></i><span class="mentor-label">' + escapeHtml(uiMessages.mentorOpen || "افتح المحادثة") + '</span></button></div>';
      const mentorTopbarStyle = '<style id="mentor-top-access-style">.mentor-topbar{position:fixed;top:14px;right:18px;z-index:1100;display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(255,215,0,.45);border-radius:18px;background:rgba(10,14,39,.9);backdrop-filter:blur(12px);box-shadow:0 10px 28px rgba(0,0,0,.28);color:#fff}.mentor-topbar img{width:38px;height:38px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,215,0,.5)}.mentor-topbar div{display:flex;flex-direction:column;gap:2px;min-width:105px}.mentor-topbar strong{color:#ffd700;font-size:14px}.mentor-topbar span{color:rgba(255,255,255,.72);font-size:11px}.mentor-topbar button{border:1px solid #ffd700;background:transparent;color:#ffd700;border-radius:999px;padding:7px 11px;font:700 12px Tajawal,sans-serif;cursor:pointer;transition:transform .2s,background .2s,color .2s}.mentor-topbar button:hover{transform:translateY(-2px);background:#ffd700;color:#0a0e27}@media(max-width:640px){.mentor-topbar{top:10px;right:10px;left:10px;justify-content:flex-start;padding:7px 9px}.mentor-topbar div{flex:1;min-width:0}.mentor-topbar .mentor-label{display:none}.mentor-topbar button{width:40px;height:34px;padding:0}.mentor-topbar button i{margin:0}}</style>';
      sanitized = sanitized.replace(/<\/head>/i, mentorTopbarStyle + '</head>');
      sanitized = sanitized.replace(/<body\b[^>]*>/i, '$&' + mentorTopbar);
    }
    if (!/function\s+openChapterMentor\s*\(/.test(sanitized)) {
      const mentorHelper = '<script>function openChapterMentor(){var fab=document.getElementById("mentor-fab");if(fab){fab.click();return;}if(window.LMSMentor){window.LMSMentor.mount(typeof CHAPTER_NUM==="number"?CHAPTER_NUM:1);setTimeout(function(){var mountedFab=document.getElementById("mentor-fab");if(mountedFab)mountedFab.click();},80);}}</script>';
      sanitized = sanitized.replace(/<\/body>/i, mentorHelper + '</body>');
    }
    const hasMentorScript = /<script\b[^>]*\bsrc=(['"])[^'"]*mentor\.js\1/i.test(sanitized);
    if (!hasMentorScript) {
      const mentorBootstrap = '<script>(function(){function mount(){if(window.LMSMentor&&!document.getElementById("mentor-fab"))window.LMSMentor.mount(typeof CHAPTER_NUM==="number"?CHAPTER_NUM:1);}function load(){if(window.LMSMentor){mount();return;}var script=document.createElement("script");script.src="https://www.quadralevel.com/js/mentor.js";script.async=false;script.onload=mount;document.head.appendChild(script);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();})();</script>';
      sanitized = sanitized.replace(/<\/body>/i, mentorBootstrap + '</body>');
    }
    if (!/id=(['"])ql-how-to-make\1/i.test(sanitized)) {
      sanitized = sanitized.replace(/<\/body>/i, renderHowToMakeSection(courseSlug, chapterNumber) + '</body>');
    }
    const mentorImageFix = '<script>(function(){var image=' + JSON.stringify(PUBLIC_MENTOR_IMAGE) + ';var dashboard=' + JSON.stringify(dashboardUrl) + ';function sync(){document.querySelectorAll(`#mentor-fab img,#mentor-panel img,.mentor-topbar img,.mentor-avatar-small,.mh-icon img,img[src*="kero"],img[src*="mentor"]`).forEach(function(node){if(node.getAttribute("src")!==image)node.src=image;});document.querySelectorAll("a").forEach(function(node){var href=node.getAttribute("href")||"";var label=node.textContent||"";if(/dashboard\\.html|(?:^|\\/)courses(?:\\.html)?(?:[?#]|$)/i.test(href)&&/لوحتي|لوحة التعلم/i.test(label)){node.setAttribute("href",dashboard);node.setAttribute("target","_top");}});}function boot(){sync();if(window.MutationObserver){new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();})();</script>';
    sanitized = sanitized.replace(/<\/body>/i, mentorImageFix + '</body>');
  }
  return Buffer.from(sanitized, "utf8");
}

function contentCookieName(courseIdentifier) {
  const safeIdentifier = String(courseIdentifier || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `ql_content_token_${safeIdentifier}`;
}

function readCookie(header, name) {
  const prefix = `${name}=`;
  for (const part of String(header || "").split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return "";
}

async function discoverStoredPath(bucket, prefix, requestedPath) {
  const root = String(prefix || "").replace(/\/+$/, "");
  const target = String(requestedPath || "").replace(/\\/g, "/").toLowerCase();
  if (!bucket || !root || !target) return "";
  const queue = [root];
  const visited = new Set();
  const basename = target.split("/").pop();
  let scanned = 0;
  while (queue.length && scanned < 2000) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const { data, error } = await supabase.storage.from(bucket).list(current, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data || []) {
      scanned += 1;
      const child = `${current}/${item.name}`;
      const relative = child.slice(root.length + 1).replace(/\\/g, "/");
      if (relative.toLowerCase() === target) return relative;
      if ((target.endsWith("/ch1.html") || target.endsWith("/index.html")) && String(item.name || "").toLowerCase() === basename && item.id) {
        return relative;
      }
      if (!item.id && item.name) queue.push(child);
      if (scanned >= 2000) break;
    }
  }
  return "";
}

async function downloadCourseFile(course, requestedPath) {
  const candidates = [requestedPath];
  const basename = String(requestedPath || "").split("/").pop().toLowerCase();
  if (basename === "ch1.html" || basename === "index.html") {
    const discovered = await discoverStoredPath(course.content_bucket, course.content_prefix, requestedPath);
    if (discovered && !candidates.includes(discovered)) candidates.push(discovered);
  }
  for (const path of candidates) {
    const { data, error } = await supabase.storage.from(course.content_bucket).download(`${course.content_prefix}/${path}`);
    if (!error && data) return { data, path };
  }
  return null;
}

function tokenFromReferer(req) {
  const referer = String(req.get("referer") || "").trim();
  if (!referer) return "";
  try {
    const refererUrl = new URL(referer);
    const requestOrigin = `${req.protocol}://${req.get("host")}`;
    if (refererUrl.origin !== requestOrigin || !refererUrl.pathname.startsWith("/api/content/")) return "";
    return String(refererUrl.searchParams.get("access_token") || "").trim();
  } catch (e) {
    return "";
  }
}

function contentIdentity(req) {
  const sessionUserId = authenticate(req);
  if (sessionUserId) return { userId: sessionUserId, scopedCourseId: null, accessToken: "" };
  const candidates = [
    String(req.query.access_token || "").trim(),
    readCookie(req.headers.cookie, contentCookieName(req.params.courseId)),
    tokenFromReferer(req),
  ].filter(Boolean);
  for (const accessToken of candidates) {
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
      if (payload.scope !== "course-content" || !payload.userId || !payload.courseId) continue;
      return { userId: payload.userId, scopedCourseId: String(payload.courseId), accessToken };
    } catch (e) {
      // Try the next transport (cookie or same-origin referrer) if this token is stale.
    }
  }
  return null;
}

// GET /api/content/:courseId/* — private course file gateway.
router.get("/:courseId/*", async (req, res) => {
  try {
    const identity = contentIdentity(req);
    if (!identity) return res.status(401).json({ ok: false, error: "رمز الوصول غير صالح أو منتهي." });
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    if (identity.scopedCourseId && identity.scopedCourseId !== String(course.id)) return res.status(403).json({ ok: false, error: "رمز الوصول لا يخص هذا الكورس." });
    const access = await getAccess(identity.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى محتوى هذا الكورس." });
    if (!course.content_bucket || !course.content_prefix) return res.status(404).json({ ok: false, error: "محتوى الكورس غير مرفوع بعد." });

    let requestedPath = safeRelativePath(req.params[0] || course.entry_file);
    if (!requestedPath) return res.status(400).json({ ok: false, error: "مسار الملف غير صالح." });
    const chapterFile = requestedPath.match(/(?:^|\/)ch(\d+)\.html$/i);
    const quizFile = /(?:^|\/)quiz\.html$/i.test(requestedPath) ? Number(req.query.ch || 0) : 0;
    const requestedChapter = chapterFile ? Number(chapterFile[1]) : quizFile || (/(?:^|\/)index\.html$/i.test(requestedPath) ? 1 : 0);
    if (requestedChapter > 1) {
      const unlock = await isChapterUnlocked(identity.userId, course.id, requestedChapter);
      if (!unlock.unlocked) return res.status(403).json({ ok: false, error: "هذا الفصل مقفول. اجتز اختبار الفصل السابق أولًا." });
    }
    const currentEntryPath = safeRelativePath(course.entry_file);
    if (currentEntryPath && requestedPath === currentEntryPath && !/\.html?$/i.test(requestedPath)) {
      const resolvedEntry = await resolveEntryFile(course);
      if (resolvedEntry) requestedPath = resolvedEntry;
    }
    const stored = await downloadCourseFile(course, requestedPath);
    if (!stored) return res.status(404).json({ ok: false, error: "ملف الكورس غير موجود." });
    if (stored.path !== requestedPath && /(?:^|\/)ch1\.html$/i.test(requestedPath)) {
      const { error: repairError } = await supabase.from("courses").update({ entry_file: stored.path, updated_at: new Date().toISOString() }).eq("id", course.id);
      if (repairError) console.warn("Course entry path repair skipped:", repairError.message || repairError);
      requestedPath = stored.path;
    }

    const sourceBuffer = Buffer.from(await stored.data.arrayBuffer());
    const contentType = mime.lookup(requestedPath) || "application/octet-stream";
    const isHtmlContent = /text\/html/i.test(contentType);
    res.set({
      "Content-Type": contentType,
      "Cache-Control": isHtmlContent || access.accessType !== "enrolled" ? "private, no-store" : "private, max-age=300",
      "Referrer-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    if (identity.accessToken) {
      let maxAge = 900;
      try {
        const payload = jwt.decode(identity.accessToken);
        if (payload && Number.isFinite(payload.exp)) maxAge = Math.max(60, Number(payload.exp) - Math.floor(Date.now() / 1000));
      } catch (e) {
        // Keep the short default if decoding is unavailable.
      }
      res.append("Set-Cookie", `${contentCookieName(req.params.courseId)}=${encodeURIComponent(identity.accessToken)}; Path=/api/content/${encodeURIComponent(req.params.courseId)}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`);
    }
    let responseBody = sourceBuffer;
    if (isHtmlContent) {
      const country = await getUserCountry(identity.userId);
      const variants = await getCourseVariants(course.id, country.countryCode);
      const lessonVariant = requestedChapter > 0 ? variants.lessons.get(`ch${requestedChapter}`) : null;
      const hasExplicitLessonVariant = Boolean(lessonVariant?.content_html);
      const courseSlug = String(course.slug || "").trim().toLowerCase();
      const isEgyptianMarketingLaunch = courseSlug === "marketing-launch" && country.countryCode === "EG" && requestedChapter > 0;
      const preserveUploadedCourse = shouldPreserveUploadedCourse(courseSlug);
      // For uploaded Launch/Growth/Mastery/Leadership content, the published ZIP is the source of truth.
      // Do not let legacy lesson variants or dialect rewriting alter its wording.
      const usePublishedSource = preserveUploadedCourse || !hasExplicitLessonVariant || isEgyptianMarketingLaunch;
      const htmlBuffer = usePublishedSource ? sourceBuffer : Buffer.from(String(lessonVariant.content_html), "utf8");
      const preparedHtml = prepareCourseHtml(htmlBuffer, requestedPath, course.slug, course.id, country);
      const dialectCountry = isEgyptianMarketingLaunch ? { ...country, countryCode: "FUSHA", dialect: "العربية الفصحى" } : country;
      const preserveUploadedContent = usePublishedSource && preserveUploadedCourse;
      const serverLocalizedHtml = isEgyptianMarketingLaunch && !preserveUploadedContent ? rewriteHtmlTextNodes("FUSHA", preparedHtml) : preparedHtml;
      responseBody = usePublishedSource
        ? (preserveUploadedContent ? preparedHtml : injectContentDialect(serverLocalizedHtml, dialectCountry))
        : serverLocalizedHtml;
    }
    res.send(responseBody);
  } catch (e) {
    console.error("Course content error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل محتوى الكورس." });
  }
});

module.exports = router;
module.exports.prepareCourseHtml = prepareCourseHtml;
module.exports.shouldPreserveUploadedCourse = shouldPreserveUploadedCourse;
module.exports.renderHowToMakeSection = renderHowToMakeSection;
