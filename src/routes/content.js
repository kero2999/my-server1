const express = require("express");
const jwt = require("jsonwebtoken");
const mime = require("mime-types");
const supabase = require("../db");
const { authenticate } = require("../middleware/auth");
const { findPublishedCourse, getAccess, resolveEntryFile } = require("./courses");

const router = express.Router();

function safeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:$/.test(part))) return null;
  return parts.join("/");
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
    const currentEntryPath = safeRelativePath(course.entry_file);
    if (currentEntryPath && requestedPath === currentEntryPath && !/\.html?$/i.test(requestedPath)) {
      const resolvedEntry = await resolveEntryFile(course);
      if (resolvedEntry) requestedPath = resolvedEntry;
    }
    const storagePath = `${course.content_prefix}/${requestedPath}`;
    const { data, error } = await supabase.storage.from(course.content_bucket).download(storagePath);
    if (error || !data) return res.status(404).json({ ok: false, error: "ملف الكورس غير موجود." });

    const buffer = Buffer.from(await data.arrayBuffer());
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
    res.send(buffer);
  } catch (e) {
    console.error("Course content error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل محتوى الكورس." });
  }
});

module.exports = router;
