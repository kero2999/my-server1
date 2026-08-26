const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rate-limit");
const { buildLearning, evaluateProject, isChapterUnlocked } = require("../learning");
const router = express.Router();

const DEFAULT_TRIAL_MINUTES = 10;
const userKey = (req) => String(req.userId || req.ip || "unknown");
const trialStartLimiter = rateLimit({ name: "course-trial-start", windowMs: 15 * 60 * 1000, max: 3, keyGenerator: userKey });
const quizSubmitLimiter = rateLimit({ name: "quiz-submit", windowMs: 10 * 60 * 1000, max: 20, keyGenerator: userKey });
const projectSubmitLimiter = rateLimit({ name: "project-submit", windowMs: 15 * 60 * 1000, max: 3, keyGenerator: userKey });

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}

function courseFilter(query, identifier) {
  return isNumericId(identifier)
    ? query.eq("id", Number(identifier))
    : query.eq("slug", String(identifier));
}

function publicCourse(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    priceCents: row.price_cents,
    currency: row.currency,
    category: row.categories || null,
    instructor: row.instructor,
    status: row.status,
    trialMinutes: row.trial_minutes,
    entryFile: row.entry_file,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findPublishedCourse(identifier) {
  let query = supabase
    .from("courses")
    .select("id, slug, title, description, thumbnail_url, price_cents, currency, category_id, instructor, status, trial_minutes, entry_file, current_version_id, content_bucket, content_prefix, created_at, updated_at, categories(name, slug)")
    .eq("status", "published");
  query = courseFilter(query, identifier);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function findEnrollment(userId, courseId) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, source, purchased_at, created_at, updated_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findTrial(userId, courseId) {
  const { data, error } = await supabase
    .from("course_trials")
    .select("id, started_at, expires_at, starts_count")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function trialStatus(trial) {
  if (!trial) return { started: false, active: false, remainingSeconds: 0 };
  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(trial.expires_at).getTime() - Date.now()) / 1000)
  );
  return {
    started: true,
    active: remainingSeconds > 0,
    remainingSeconds,
    startedAt: trial.started_at,
    expiresAt: trial.expires_at,
  };
}

function manifestFilePath(file) {
  if (typeof file === "string") return file.trim();
  if (!file || typeof file !== "object") return "";
  return String(file.path || file.name || file.relativePath || "").trim();
}

function pickIndexFile(files, currentEntry) {
  const paths = (Array.isArray(files) ? files : [])
    .map(manifestFilePath)
    .filter(Boolean);
  const lower = (value) => String(value).toLowerCase().replace(/\\/g, "/");
  const exact = paths.find((file) => lower(file) === "index.html");
  if (exact) return exact;
  const nested = paths.find((file) => lower(file).endsWith("/index.html"));
  if (nested) return nested;

  const current = String(currentEntry || "").replace(/\\/g, "/");
  const slash = current.lastIndexOf("/");
  if (slash > 0) {
    const directory = lower(current.slice(0, slash));
    const sibling = paths.find((file) => {
      const normalized = lower(file);
      return normalized === `${directory}/index.html`;
    });
    if (sibling) return sibling;
  }
  return "";
}

function preferredStartFile(currentEntry, course) {
  if (String(course?.slug || "") === "level-2") return "ch1.html";
  return /(?:^|\/)capacitor-setup\.md$/i.test(String(currentEntry || "").replace(/\\/g, "/")) ? "ch1.html" : "index.html";
}

function pickCourseEntryFile(files, currentEntry, course) {
  const paths = (Array.isArray(files) ? files : [])
    .map(manifestFilePath)
    .filter(Boolean);
  const lower = (value) => String(value).toLowerCase().replace(/\\/g, "/");
  const preferred = preferredStartFile(currentEntry, course).toLowerCase();
  const current = String(currentEntry || "").replace(/\\/g, "/");
  const slash = current.lastIndexOf("/");
  const directory = slash > 0 ? lower(current.slice(0, slash)) : "";
  const sibling = directory
    ? paths.find((file) => lower(file) === `${directory}/${preferred}`)
    : paths.find((file) => lower(file) === preferred);
  if (sibling) return sibling;
  if (preferred === "ch1.html") {
    const lesson = paths.find((file) => lower(file).endsWith("/ch1.html"));
    if (lesson) return lesson;
  }
  return pickIndexFile(paths, currentEntry);
}

async function findFileInStorage(bucket, prefix, fileName) {
  const root = String(prefix || "").replace(/\/+$/, "");
  if (!bucket || !root) return "";
  const target = String(fileName || "").toLowerCase();
  const queue = [root];
  const visited = new Set();
  let scanned = 0;
  while (queue.length && scanned < 2000) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(current, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data || []) {
      scanned += 1;
      const child = `${current}/${item.name}`;
      if (String(item.name || "").toLowerCase() === target) return child.slice(root.length + 1);
      if (!item.id && item.name) queue.push(child);
      if (scanned >= 2000) break;
    }
  }
  return "";
}

async function resolveEntryFile(course) {
  const currentEntry = String(course?.entry_file || "").trim();
  // Marketing Launch is uploaded with a root index.html. Avoid a storage tree scan
  // on every content-token request; the content gateway still discovers a nested
  // index.html if an older upload placed the files under a folder.
  if (String(course?.slug || "") === "marketing-launch" && /\.html?$/i.test(currentEntry)) {
    return currentEntry;
  }
  const preferred = preferredStartFile(currentEntry, course);
  if (course?.current_version_id) {
    const { data: version, error } = await supabase
      .from("course_versions")
      .select("manifest")
      .eq("id", course.current_version_id)
      .maybeSingle();
    if (error) throw error;
    const manifestEntry = pickCourseEntryFile(version?.manifest?.files, currentEntry, course);
    if (manifestEntry) return manifestEntry;
  }
  const storageEntry = await findFileInStorage(course?.content_bucket, course?.content_prefix, preferred);
  if (storageEntry) return storageEntry;
  return currentEntry;
}

async function getAccess(userId, courseId) {
  const [enrollment, trial] = await Promise.all([
    findEnrollment(userId, courseId),
    findTrial(userId, courseId),
  ]);
  const activeEnrollment = enrollment && enrollment.status === "active";
  const trialInfo = trialStatus(trial);
  return {
    enrolled: Boolean(activeEnrollment),
    enrollment: activeEnrollment ? enrollment : null,
    trial: trialInfo,
    canAccess: Boolean(activeEnrollment || trialInfo.active),
    accessType: activeEnrollment ? "enrolled" : trialInfo.active ? "trial" : "none",
  };
}

function accessError(res, error) {
  console.error("Courses API error:", error);
  return res.status(500).json({ ok: false, error: "تعذّر تحميل بيانات الكورس حاليًا." });
}

// GET /api/courses — public catalog; only published courses are exposed.
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("courses")
      .select("id, slug, title, description, thumbnail_url, price_cents, currency, category_id, instructor, status, trial_minutes, entry_file, created_at, updated_at, categories(name, slug)")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (req.query.category) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", String(req.query.category))
        .maybeSingle();
      if (!category) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        return res.json({ ok: true, courses: [] });
      }
      query = query.eq("category_id", category.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ ok: true, courses: (data || []).map(publicCourse) });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId — public details for a published course.
router.get("/:courseId", async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ ok: true, course: publicCourse(course) });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/access — authoritative entitlement/trial state.
router.get("/:courseId/learning", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "ابدأ التجربة أو اشترِ الكورس للوصول إلى لوحة التعلم." });
    const learning = await buildLearning({ userId: req.userId, course, access });
    res.json({ ok: true, learning: { ...learning, course: publicCourse(course) } });
  } catch (e) {
    accessError(res, e);
  }
});

router.get("/:courseId/content-token", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى محتوى هذا الكورس." });
    const entryFile = await resolveEntryFile(course);
    if (entryFile && entryFile !== course.entry_file) {
      const { error: repairError } = await supabase
        .from("courses")
        .update({ entry_file: entryFile, updated_at: new Date().toISOString() })
        .eq("id", course.id);
      if (repairError) {
        console.warn("Course entry repair skipped:", repairError.message || repairError);
      } else {
        course.entry_file = entryFile;
      }
    }
    const token = jwt.sign({ userId: req.userId, courseId: String(course.id), scope: "course-content" }, process.env.JWT_SECRET, { expiresIn: access.accessType === "trial" ? "15m" : "1h" });
    res.json({ ok: true, token, entryFile, expiresIn: access.accessType === "trial" ? 900 : 3600 });
  } catch (e) {
    accessError(res, e);
  }
});

router.get("/:courseId/access", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    res.json({ ok: true, course: publicCourse(course), access });
  } catch (e) {
    accessError(res, e);
  }
});

// POST /api/courses/:courseId/trial/start — one server-tracked trial per user/course.
router.post("/:courseId/trial/start", requireAuth, trialStartLimiter, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });

    const enrollment = await findEnrollment(req.userId, course.id);
    if (enrollment && enrollment.status === "active") {
      return res.json({ ok: true, access: await getAccess(req.userId, course.id) });
    }

    const existing = await findTrial(req.userId, course.id);
    if (existing) {
      return res.json({ ok: true, access: await getAccess(req.userId, course.id) });
    }

    const minutes = Number(course.trial_minutes || DEFAULT_TRIAL_MINUTES);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + minutes * 60 * 1000);
    const { error } = await supabase.from("course_trials").insert({
      user_id: req.userId,
      course_id: course.id,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      starts_count: 1,
    });
    if (error) throw error;

    res.status(201).json({ ok: true, access: await getAccess(req.userId, course.id) });
  } catch (e) {
    // A unique race means a second request reused the already-created trial.
    if (e && e.code === "23505") {
      try {
        return res.json({ ok: true, access: await getAccess(req.userId, Number(req.params.courseId)) });
      } catch (retryError) {
        return accessError(res, retryError);
      }
    }
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/progress — progress is available only with course access.
router.get("/:courseId/progress", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "ابدأ التجربة أو اشترِ الكورس للوصول إلى التقدم." });

    const { data, error } = await supabase
      .from("course_progress")
      .select("lesson_key, progress, completed, last_position, updated_at")
      .eq("user_id", req.userId)
      .eq("course_id", course.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, progress: data || [] });
  } catch (e) {
    accessError(res, e);
  }
});

async function saveProgress(req, res, forceComplete) {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });

    const lessonKey = String(req.body.lessonKey || req.params.lessonKey || "").trim();
    if (!lessonKey) return res.status(400).json({ ok: false, error: "lessonKey مطلوب." });
    const requestedProgress = Number(req.body.progress ?? (forceComplete ? 100 : 0));
    const progress = Math.max(0, Math.min(100, Number.isFinite(requestedProgress) ? requestedProgress : 0));
    const completed = forceComplete || Boolean(req.body.completed) || progress >= 100;
    const lastPosition = req.body.lastPosition && typeof req.body.lastPosition === "object" ? req.body.lastPosition : {};
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", course.id)
      .eq("lesson_key", lessonKey)
      .maybeSingle();
    if (lessonError) throw lessonError;

    const { data, error } = await supabase
      .from("course_progress")
      .upsert({
        user_id: req.userId,
        course_id: course.id,
        lesson_id: lesson ? lesson.id : null,
        lesson_key: lessonKey,
        progress,
        completed,
        last_position: lastPosition,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,course_id,lesson_key" })
      .select("lesson_key, progress, completed, last_position, updated_at")
      .single();
    if (error) throw error;
    res.json({ ok: true, progress: data });
  } catch (e) {
    accessError(res, e);
  }
}

router.put("/:courseId/progress", requireAuth, (req, res) => saveProgress(req, res, false));
router.post("/:courseId/lessons/:lessonKey/complete", requireAuth, (req, res) => saveProgress(req, res, true));

function findByIdOrKey(query, identifier, keyColumn) {
  return isNumericId(identifier) ? query.eq("id", Number(identifier)) : query.eq(keyColumn, String(identifier));
}

// POST /api/courses/:courseId/quizzes/:quizId/submit — score answers server-side.
router.post("/:courseId/quizzes/:quizId/submit", requireAuth, quizSubmitLimiter, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });

    let quizQuery = supabase.from("quizzes").select("id, quiz_key, title, passing_score, questions").eq("course_id", course.id);
    quizQuery = findByIdOrKey(quizQuery, req.params.quizId, "quiz_key");
    const { data: quiz, error: quizError } = await quizQuery.maybeSingle();
    if (quizError) throw quizError;
    if (!quiz) return res.status(404).json({ ok: false, error: "الاختبار غير موجود." });
    const quizChapter = Number(String(quiz.quiz_key || "").match(/(\d+)/)?.[1] || 0);
    if (quizChapter > 1) {
      const unlock = await isChapterUnlocked(req.userId, course.id, quizChapter);
      if (!unlock.unlocked) return res.status(403).json({ ok: false, error: "اجتز اختبار الفصل السابق أولًا." });
    }

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (!questions.length) return res.status(400).json({ ok: false, error: "الاختبار لا يحتوي على أسئلة." });
    let correct = 0;
    questions.forEach((question, index) => {
      const answer = answers[index];
      if (question.correctIndex !== undefined && Number(answer) === Number(question.correctIndex)) correct += 1;
      else if (question.correctAnswer !== undefined && String(answer) === String(question.correctAnswer)) correct += 1;
      else if (question.answer !== undefined && String(answer) === String(question.answer)) correct += 1;
    });
    const score = Math.round((correct / questions.length) * 10000) / 100;
    const passed = score >= Number(quiz.passing_score || 70);
    const { data: attempt, error } = await supabase.from("quiz_attempts").insert({
      user_id: req.userId,
      course_id: course.id,
      quiz_id: quiz.id,
      score,
      passed,
      answers,
      attempted_at: new Date().toISOString(),
    }).select("id, score, passed, attempted_at").single();
    if (error) throw error;
    res.status(201).json({ ok: true, attempt });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/quizzes/:quizId/result — best server-side attempt.
router.get("/:courseId/quizzes/:quizId/result", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });
    let quizQuery = supabase.from("quizzes").select("id").eq("course_id", course.id);
    quizQuery = findByIdOrKey(quizQuery, req.params.quizId, "quiz_key");
    const { data: quiz, error: quizError } = await quizQuery.maybeSingle();
    if (quizError) throw quizError;
    if (!quiz) return res.status(404).json({ ok: false, error: "الاختبار غير موجود." });
    const { data, error } = await supabase.from("quiz_attempts").select("id, score, passed, attempted_at").eq("user_id", req.userId).eq("course_id", course.id).eq("quiz_id", quiz.id).order("score", { ascending: false }).order("attempted_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    res.json({ ok: true, result: data || null });
  } catch (e) {
    accessError(res, e);
  }
});

// POST /api/courses/:courseId/projects/:projectId/submit — AI-graded project submission.
router.post("/:courseId/projects/:projectId/submit", requireAuth, projectSubmitLimiter, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });
    const text = String(req.body.text || "").trim();
    if (text.length < 80) return res.status(400).json({ ok: false, error: "اكتب مشروعًا لا يقل عن 80 حرفًا حتى يستطيع الذكاء الاصطناعي تقييمه." });
    if (text.length > 12000) return res.status(400).json({ ok: false, error: "حجم المشروع كبير جدًا. اختصره إلى 12000 حرف أو أقل." });

    let projectQuery = supabase.from("projects").select("id, project_key, title, instructions, passing_score").eq("course_id", course.id);
    projectQuery = findByIdOrKey(projectQuery, req.params.projectId, "project_key");
    const { data: project, error: projectError } = await projectQuery.maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, error: "المشروع غير موجود." });
    const learning = await buildLearning({ userId: req.userId, course, access });
    if (!learning.overall.allQuizzesPassed) return res.status(403).json({ ok: false, error: "أكمل واجتز اختبارات جميع الفصول أولًا." });

    const { data: user, error: userError } = await supabase.from("users").select("email, full_name").eq("id", req.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });

    let evaluation;
    try {
      evaluation = await evaluateProject({ course, project, student: user, text });
    } catch (error) {
      console.error("Project evaluation failed:", error);
      if (error.code === "AI_EVALUATOR_NOT_CONFIGURED") {
        return res.status(503).json({ ok: false, error: "تقييم الذكاء الاصطناعي غير مضبوط على الخادم بعد." });
      }
      return res.status(502).json({ ok: false, error: "تعذر تقييم المشروع الآن. حاول مرة أخرى." });
    }

    const passingScore = Number(project.passing_score || 70);
    const passed = Number(evaluation.score) >= passingScore;
    const status = passed ? "passed" : "failed";
    const { data: submission, error } = await supabase.from("project_submissions").insert({
      user_id: req.userId,
      email: user.email || "",
      course_id: course.id,
      project_id: project.id,
      content: text,
      status,
      score: Number(evaluation.score),
      feedback: String(evaluation.feedback || "").trim(),
      ai_evaluation: evaluation,
      evaluated_at: new Date().toISOString(),
    }).select("id, course_id, project_id, status, score, feedback, ai_evaluation, evaluated_at, submitted_at").single();
    if (error) throw error;
    res.status(201).json({ ok: true, submission, passed, passingScore });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/projects/:projectId/status — latest submission status.
router.get("/:courseId/projects/:projectId/status", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });
    let projectQuery = supabase.from("projects").select("id").eq("course_id", course.id);
    projectQuery = findByIdOrKey(projectQuery, req.params.projectId, "project_key");
    const { data: project, error: projectError } = await projectQuery.maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, error: "المشروع غير موجود." });
    const { data, error } = await supabase.from("project_submissions").select("id, status, score, feedback, ai_evaluation, evaluated_at, submitted_at").eq("user_id", req.userId).eq("course_id", course.id).eq("project_id", project.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    res.json({ ok: true, submission: data || null });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/certificate — issue only after server-verified requirements.
router.get("/:courseId/certificate", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.enrolled) return res.status(403).json({ ok: false, error: "اشترِ الكورس أولًا للحصول على الشهادة." });

    const [{ data: lessons, error: lessonsError }, { data: quizzes, error: quizzesError }, { data: projects, error: projectsError }] = await Promise.all([
      supabase.from("lessons").select("id").eq("course_id", course.id),
      supabase.from("quizzes").select("id").eq("course_id", course.id),
      supabase.from("projects").select("id").eq("course_id", course.id),
    ]);
    if (lessonsError || quizzesError || projectsError) throw lessonsError || quizzesError || projectsError;

    const lessonIds = (lessons || []).map((lesson) => lesson.id);
    const [{ data: progress, error: progressError }, { data: attempts, error: attemptsError }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase.from("course_progress").select("lesson_id, completed").eq("user_id", req.userId).eq("course_id", course.id),
      supabase.from("quiz_attempts").select("quiz_id, score, passed, attempted_at").eq("user_id", req.userId).eq("course_id", course.id).eq("passed", true),
      supabase.from("project_submissions").select("project_id, status, score, submitted_at").eq("user_id", req.userId).eq("course_id", course.id).in("status", ["completed", "approved", "passed"]),
    ]);
    if (progressError || attemptsError || submissionsError) throw progressError || attemptsError || submissionsError;

    const completedLessonIds = new Set((progress || []).filter((item) => item.completed).map((item) => item.lesson_id));
    const passedQuizIds = new Set((attempts || []).map((item) => item.quiz_id));
    const completedProjectIds = new Set((submissions || []).map((item) => item.project_id));
    const quizScoresById = new Map();
    (attempts || []).forEach((attempt) => {
      const previous = quizScoresById.get(attempt.quiz_id);
      if (!previous || Number(attempt.score || 0) > Number(previous.score || 0)) quizScoresById.set(attempt.quiz_id, attempt);
    });
    const scoredQuizzes = (quizzes || []).map((quiz) => quizScoresById.get(quiz.id)).filter(Boolean);
    const quizAverage = scoredQuizzes.length ? Math.round((scoredQuizzes.reduce((sum, item) => sum + Number(item.score || 0), 0) / scoredQuizzes.length) * 100) / 100 : 0;
    const projectSubmission = (submissions || []).slice().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0] || null;
    const { data: student, error: studentError } = await supabase.from("users").select("id, full_name, email").eq("id", req.userId).maybeSingle();
    if (studentError) throw studentError;
    const certificateDetails = {
      course: publicCourse(course),
      student,
      scores: { quizAverage, projectScore: projectSubmission ? Number(projectSubmission.score || 0) : 0 },
    };
    const lessonsOk = !lessonIds.length || lessonIds.every((id) => completedLessonIds.has(id));
    const quizzesOk = !(quizzes || []).length || (quizzes || []).every((quiz) => passedQuizIds.has(quiz.id));
    const projectsOk = !(projects || []).length || (projects || []).every((project) => completedProjectIds.has(project.id));
    if (!lessonsOk || !quizzesOk || !projectsOk) return res.status(403).json({ ok: false, error: "لم تستوفِ شروط الشهادة بعد.", requirements: { lessons: lessonsOk, quizzes: quizzesOk, projects: projectsOk } });

    const { data: existing, error: existingError } = await supabase.from("certificates").select("certificate_number, verification_code, issued_at, course_id").eq("user_id", req.userId).eq("course_id", course.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.json({ ok: true, certificate: existing, ...certificateDetails });
    const certificate = {
      user_id: req.userId,
      course_id: course.id,
      certificate_number: `QL-${course.id}-${req.userId}-${Date.now()}`,
      verification_code: crypto.randomBytes(16).toString("hex"),
    };
    const { data: created, error } = await supabase.from("certificates").insert(certificate).select("certificate_number, verification_code, issued_at, course_id").single();
    if (error) throw error;
    res.status(201).json({ ok: true, certificate: created, ...certificateDetails });
  } catch (e) {
    accessError(res, e);
  }
});

module.exports = router;
module.exports.findPublishedCourse = findPublishedCourse;
module.exports.getAccess = getAccess;
module.exports.findPublishedCourse = findPublishedCourse;
module.exports.getAccess = getAccess;
module.exports.resolveEntryFile = resolveEntryFile;
module.exports.pickIndexFile = pickIndexFile;
module.exports.pickCourseEntryFile = pickCourseEntryFile;
