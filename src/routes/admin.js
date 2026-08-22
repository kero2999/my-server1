const express = require("express");
const crypto = require("crypto");
const unzipper = require("unzipper");
const mime = require("mime-types");
const supabase = require("../db");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();
const COURSE_FILES_BUCKET = process.env.COURSE_FILES_BUCKET || "course-files";

function normalizeZipPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  while (parts.length > 1 && /\uFFFD/u.test(parts[0])) parts.shift();
  if (!parts.length || parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:$/.test(part))) return null;
  if (parts.some((part) => /[\u0000-\u001F\u007F]/u.test(part) || /\uFFFD/u.test(part))) return null;
  return parts.join("/");
}

async function findIndexFileInStorage(bucket, prefix) {
  const queue = [String(prefix || "").replace(/\/+$/, "")];
  const visited = new Set();
  let scanned = 0;
  while (queue.length && scanned < 1000) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const { data, error } = await supabase.storage.from(bucket).list(current, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data || []) {
      scanned += 1;
      const child = `${current}/${item.name}`;
      if (String(item.name || "").toLowerCase() === "index.html") return child;
      if (!item.id && item.name) queue.push(child);
      if (scanned >= 1000) break;
    }
  }
  return "";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function numericId(value) {
  return /^\d+$/.test(String(value || "")) ? Number(value) : null;
}

function publicAdminCourse(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    priceCents: row.price_cents,
    currency: row.currency,
    categoryId: row.category_id,
    instructor: row.instructor,
    status: row.status,
    trialMinutes: row.trial_minutes,
    entryFile: row.entry_file,
    contentBucket: row.content_bucket,
    contentPrefix: row.content_prefix,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.use(requireAdmin);

router.get("/categories", async (req, res) => {
  try {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw error;
    res.json({ ok: true, categories: data || [] });
  } catch (e) {
    console.error("Admin categories list error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل التصنيفات." });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const slug = slugify(req.body.slug || name);
    if (!name || !slug) return res.status(400).json({ ok: false, error: "اسم التصنيف مطلوب." });
    const { data, error } = await supabase.from("categories").insert({ name, slug, description: req.body.description || null }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, category: data });
  } catch (e) {
    console.error("Admin category create error:", e);
    res.status(500).json({ ok: false, error: "تعذر إنشاء التصنيف." });
  }
});

router.get("/courses", async (req, res) => {
  try {
    let query = supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (req.query.status) query = query.eq("status", String(req.query.status));
    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, courses: (data || []).map(publicAdminCourse) });
  } catch (e) {
    console.error("Admin course list error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحميل الكورسات." });
  }
});

router.post("/courses", async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const slug = slugify(req.body.slug || title);
    const priceCents = Number(req.body.priceCents ?? 0);
    const trialMinutes = Number(req.body.trialMinutes ?? 10);
    if (!title || !slug) return res.status(400).json({ ok: false, error: "عنوان الكورس مطلوب." });
    if (!Number.isInteger(priceCents) || priceCents < 0) return res.status(400).json({ ok: false, error: "السعر يجب أن يكون رقمًا صحيحًا بالسنتات." });
    if (!Number.isInteger(trialMinutes) || trialMinutes < 0 || trialMinutes > 1440) return res.status(400).json({ ok: false, error: "مدة التجربة غير صالحة." });
    const { data, error } = await supabase.from("courses").insert({
      slug,
      title,
      description: String(req.body.description || ""),
      thumbnail_url: req.body.thumbnailUrl || null,
      price_cents: priceCents,
      currency: String(req.body.currency || "EGP").toUpperCase(),
      category_id: req.body.categoryId ? Number(req.body.categoryId) : null,
      instructor: req.body.instructor || null,
      status: "draft",
      trial_minutes: trialMinutes,
      entry_file: String(req.body.entryFile || "index.html"),
    }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, course: publicAdminCourse(data) });
  } catch (e) {
    console.error("Admin course create error:", e);
    res.status(500).json({ ok: false, error: "تعذر إنشاء الكورس. تأكد من عدم تكرار الرابط المختصر." });
  }
});

router.patch("/courses/:courseId", async (req, res) => {
  try {
    const id = numericId(req.params.courseId);
    if (!id) return res.status(400).json({ ok: false, error: "معرف الكورس غير صالح." });
    const patch = {};
    const fields = {
      title: "title", description: "description", thumbnailUrl: "thumbnail_url", currency: "currency",
      instructor: "instructor", entryFile: "entry_file", categoryId: "category_id", trialMinutes: "trial_minutes",
    };
    Object.keys(fields).forEach((key) => {
      if (req.body[key] !== undefined) patch[fields[key]] = key === "currency" ? String(req.body[key]).toUpperCase() : req.body[key];
    });
    if (req.body.priceCents !== undefined) patch.price_cents = Number(req.body.priceCents);
    if (req.body.status !== undefined && ["draft", "published", "archived"].includes(req.body.status)) patch.status = req.body.status;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("courses").update(patch).eq("id", id).select().single();
    if (error) throw error;
    res.json({ ok: true, course: publicAdminCourse(data) });
  } catch (e) {
    console.error("Admin course update error:", e);
    res.status(500).json({ ok: false, error: "تعذر تحديث الكورس." });
  }
});

router.post("/courses/:courseId/upload-zip", express.raw({ type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"], limit: "100mb" }), async (req, res) => {
  try {
    const id = numericId(req.params.courseId);
    if (!id || !Buffer.isBuffer(req.body) || req.body.length < 4) return res.status(400).json({ ok: false, error: "ملف ZIP غير صالح." });
    if (req.body[0] !== 0x50 || req.body[1] !== 0x4b) return res.status(400).json({ ok: false, error: "الملف المرفوع يجب أن يكون ZIP." });

    const { data: course, error: courseError } = await supabase.from("courses").select("id, slug").eq("id", id).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });

    const archive = await unzipper.Open.buffer(req.body);
    const entries = [];
    let extractedBytes = 0;
    for (const entry of archive.files) {
      if (entry.type !== "File") continue;
      const normalized = normalizeZipPath(entry.path);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: "يحتوي ZIP على مسار ملف غير صالح أو مشوّه." });
      }
      extractedBytes += Number(entry.uncompressedSize || 0);
      if (extractedBytes > 250 * 1024 * 1024) return res.status(400).json({ ok: false, error: "حجم الملفات بعد فك الضغط أكبر من الحد المسموح." });
      if (entries.some((item) => item.path === normalized)) {
        return res.status(400).json({ ok: false, error: "يحتوي ZIP على مسارات ملفات متكررة بعد تصحيح الترميز." });
      }
      entries.push({ entry, path: normalized });
    }
    if (!entries.length) return res.status(400).json({ ok: false, error: "ملف ZIP لا يحتوي على ملفات قابلة للتشغيل." });

    const entryFile = entries.find((item) => item.path === "index.html")?.path || entries.find((item) => item.path.endsWith("/index.html"))?.path || entries[0].path;
    const versionLabel = new Date().toISOString().replace(/[:.]/g, "-");
    const versionPrefix = `${course.id}/${versionLabel}-${crypto.randomBytes(4).toString("hex")}`;
    const storagePath = `${versionPrefix}/source.zip`;
    const { error: uploadError } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(storagePath, req.body, { contentType: "application/zip", upsert: false });
    if (uploadError) throw uploadError;

    for (const item of entries) {
      const content = await item.entry.buffer();
      const { error: fileError } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(`${versionPrefix}/content/${item.path}`, content, {
        contentType: mime.lookup(item.path) || "application/octet-stream",
        upsert: false,
      });
      if (fileError) throw fileError;
    }

    const contentPrefix = `${versionPrefix}/content`;
    const { data: version, error: versionError } = await supabase.from("course_versions").insert({
      course_id: course.id,
      version_label: versionLabel,
      storage_bucket: COURSE_FILES_BUCKET,
      storage_prefix: contentPrefix,
      original_zip_path: storagePath,
      manifest: { uploadedBytes: req.body.length, extractedBytes, entryFile, files: entries.map((item) => item.path), uploadedAt: new Date().toISOString() },
      is_published: false,
    }).select().single();
    if (versionError) throw versionError;

    const { data: updated, error: updateError } = await supabase.from("courses").update({
      content_bucket: COURSE_FILES_BUCKET,
      content_prefix: contentPrefix,
      entry_file: entryFile,
      current_version_id: version.id,
      updated_at: new Date().toISOString(),
    }).eq("id", course.id).select().single();
    if (updateError) throw updateError;
    res.status(201).json({ ok: true, course: publicAdminCourse(updated), version });
  } catch (e) {
    console.error("Admin ZIP upload error:", e);
    res.status(500).json({ ok: false, error: "تعذر رفع ملف الكورس. تأكد من إنشاء bucket باسم COURSE_FILES_BUCKET." });
  }
});

router.post("/courses/:courseId/publish", async (req, res) => {
  try {
    const id = numericId(req.params.courseId);
    if (!id) return res.status(400).json({ ok: false, error: "معرف الكورس غير صالح." });
    const { data: course, error: courseError } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    if (!course.current_version_id) return res.status(400).json({ ok: false, error: "ارفع ZIP للكورس قبل نشره." });

    const { data: version, error: versionReadError } = await supabase
      .from("course_versions")
      .select("id, manifest")
      .eq("id", course.current_version_id)
      .maybeSingle();
    if (versionReadError) throw versionReadError;
    if (!version) return res.status(404).json({ ok: false, error: "إصدار الكورس غير موجود." });

    const manifestFiles = Array.isArray(version.manifest?.files) ? version.manifest.files : [];
    const manifestEntry = String(version.manifest?.entryFile || "").trim();
    let detectedEntry = manifestFiles.find((file) => file === "index.html") || manifestFiles.find((file) => String(file).endsWith("/index.html")) || (manifestEntry.endsWith(".html") ? manifestEntry : "");
    if (!detectedEntry && course.content_bucket && course.content_prefix) {
      detectedEntry = await findIndexFileInStorage(course.content_bucket, course.content_prefix);
    }
    const { error: versionError } = await supabase.from("course_versions").update({ is_published: true }).eq("id", course.current_version_id);
    if (versionError) throw versionError;
    const coursePatch = { status: "published", updated_at: new Date().toISOString() };
    if (detectedEntry) coursePatch.entry_file = detectedEntry;
    const { data, error } = await supabase.from("courses").update(coursePatch).eq("id", id).select().single();
    if (error) throw error;
    res.json({ ok: true, course: publicAdminCourse(data) });
  } catch (e) {
    console.error("Admin course publish error:", e);
    res.status(500).json({ ok: false, error: "تعذر نشر الكورس." });
  }
});

module.exports = router;
