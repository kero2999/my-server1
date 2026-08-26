const express = require("express");
const jwt = require("jsonwebtoken");
const mime = require("mime-types");
const supabase = require("../db");
const { authenticate } = require("../middleware/auth");
const { findPublishedCourse, getAccess, resolveEntryFile } = require("./courses");
const { isChapterUnlocked } = require("../learning");

const router = express.Router();
const PUBLIC_MENTOR_IMAGE = "https://www.quadralevel.com/images/mentor-avatar.jpeg";
const PUBLIC_MENTOR_SCRIPT = "https://www.quadralevel.com/js/mentor.js";

function courseDashboardUrl(courseSlug) {
  const slug = String(courseSlug || "").trim();
  return slug ? `https://www.quadralevel.com/dashboard/${encodeURIComponent(slug)}` : "https://www.quadralevel.com/courses";
}

function safeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:$/.test(part))) return null;
  return parts.join("/");
}

function prepareCourseHtml(buffer, requestedPath = "", courseSlug = "") {
  const html = buffer.toString("utf8");
  // The outer Marketplace gateway has already authenticated this request.
  // Disable the legacy bundle's origin-local auth redirect inside the iframe.
  let sanitized = html
    .replace(/(<html\b[^>]*?)\sdata-protected=(['"])true\2/i, '$1 data-protected="false"')
    .replace(/<script\b[^>]*\bsrc=(['"])[^'"]*auth\.js\1[^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?lms_session_v1[\s\S]*?<\/script>/gi, '');

  const isChapter = /(?:^|\/)ch\d+\.html$/i.test(String(requestedPath || ""));
  if (isChapter) {
    const dashboardUrl = courseDashboardUrl(courseSlug);
    sanitized = sanitized
      .replace(/<script\b([^>]*?)\bsrc=(['"])(?:\/?|\.\/)?js\/mentor\.js\2([^>]*)>\s*<\/script>/gi, '<script$1src="' + PUBLIC_MENTOR_SCRIPT + '"$3></script>')
      .replace(/<a(\b[^>]*?)href=(['"])(?:\.\.\/|\.\/)*dashboard\.html(?:\?[^'"]*)?\2/gi, '<a$1href="' + dashboardUrl + '" target="_top"')
      .replace(/location\.replace\(\s*(['"])(?:\.\.\/|\.\/)*dashboard\.html(?:\?[^'"]*)?\1\s*\)/gi, 'location.replace("' + dashboardUrl + '")');
    const hasChapterMentorAccess = /mentor-top-btn|mentor-topbar/i.test(sanitized);
    if (!hasChapterMentorAccess) {
      const mentorTopbar = '<div class="mentor-topbar"><img src="https://www.quadralevel.com/images/mentor-avatar.jpeg" alt="Kero Mentor"><div><strong>Mentor</strong><span>اسأل عن هذا الفصل</span></div><button type="button" onclick="openChapterMentor()"><i class="fas fa-comments"></i><span class="mentor-label">افتح المحادثة</span></button></div>';
      const mentorTopbarStyle = '<style id="mentor-top-access-style">.mentor-topbar{position:fixed;top:14px;right:18px;z-index:1100;display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(255,215,0,.45);border-radius:18px;background:rgba(10,14,39,.9);backdrop-filter:blur(12px);box-shadow:0 10px 28px rgba(0,0,0,.28);color:#fff}.mentor-topbar img{width:38px;height:38px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,215,0,.5)}.mentor-topbar div{display:flex;flex-direction:column;gap:2px;min-width:105px}.mentor-topbar strong{color:#ffd700;font-size:14px}.mentor-topbar span{color:rgba(255,255,255,.72);font-size:11px}.mentor-topbar button{border:1px solid #ffd700;background:transparent;color:#ffd700;border-radius:999px;padding:7px 11px;font:700 12px Tajawal,sans-serif;cursor:pointer;transition:transform .2s,background .2s,color .2s}.mentor-topbar button:hover{transform:translateY(-2px);background:#ffd700;color:#0a0e27}@media(max-width:640px){.mentor-topbar{top:10px;right:10px;left:10px;justify-content:flex-start;padding:7px 9px}.mentor-topbar div{flex:1;min-width:0}.mentor-topbar .mentor-label{display:none}.mentor-topbar button{width:40px;height:34px;padding:0}.mentor-topbar button i{margin:0}}</style>';
      sanitized = sanitized.replace(/<\/head>/i, mentorTopbarStyle + '</head>');
      sanitized = sanitized.replace(/<body\b[^>]*>/i, '$&' + mentorTopbar);
    }
    if (!/function\s+openChapterMentor\s*\(/.test(sanitized)) {
      const mentorHelper = '<script>function openChapterMentor(){var fab=document.getElementById("mentor-fab");if(fab){fab.click();return;}if(window.LMSMentor){window.LMSMentor.mount(typeof CHAPTER_NUM==="number"?CHAPTER_NUM:0);setTimeout(function(){var mountedFab=document.getElementById("mentor-fab");if(mountedFab)mountedFab.click();},80);}}</script>';
      sanitized = sanitized.replace(/<\/body>/i, mentorHelper + '</body>');
    }
    const mentorImageFix = '<script>(function(){var image="' + PUBLIC_MENTOR_IMAGE + '";function sync(){document.querySelectorAll("#mentor-fab img,#mentor-panel img,.mentor-topbar img,.mentor-avatar-small,.mh-icon img").forEach(function(node){if(node.getAttribute("src")!==image)node.src=image;});}function boot(){sync();if(window.MutationObserver){new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();})();</script>';
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

    const buffer = Buffer.from(await stored.data.arrayBuffer());
    res.set({
      "Content-Type": mime.lookup(requestedPath) || "application/octet-stream",
      "Cache-Control": access.accessType === "enrolled" ? "private, max-age=300" : "private, no-store",
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
    const responseBody = /text\/html/i.test(mime.lookup(requestedPath) || "") ? prepareCourseHtml(buffer, requestedPath, course.slug) : buffer;
    res.send(responseBody);
  } catch (e) {
    console.error("Course content error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل محتوى الكورس." });
  }
});

module.exports = router;
module.exports.prepareCourseHtml = prepareCourseHtml;
