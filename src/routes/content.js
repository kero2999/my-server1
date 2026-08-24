const express = require("express");
const jwt = require("jsonwebtoken");
const mime = require("mime-types");
const supabase = require("../db");
const { authenticate } = require("../middleware/auth");
const { findPublishedCourse, getAccess, resolveEntryFile } = require("./courses");
const { isChapterUnlocked } = require("../learning");

const router = express.Router();

function safeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:$/.test(part))) return null;
  return parts.join("/");
}

function prepareCourseHtml(buffer) {
  const html = buffer.toString("utf8");
  // The outer Marketplace gateway has already authenticated this request.
  // Disable the legacy bundle's origin-local auth redirect inside the iframe.
  const sanitized = html
    .replace(/(<html\b[^>]*?)\sdata-protected=(['"])true\2/i, '$1 data-protected="false"')
    .replace(/<script\b[^>]*\bsrc=(['"])[^'"]*auth\.js\1[^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?lms_session_v1[\s\S]*?<\/script>/gi, '');
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
    const responseBody = /text\/html/i.test(mime.lookup(requestedPath) || "") ? prepareCourseHtml(buffer) : buffer;
    res.send(responseBody);
  } catch (e) {
    console.error("Course content error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل محتوى الكورس." });
  }
});

module.exports = router;
module.exports.prepareCourseHtml = prepareCourseHtml;
