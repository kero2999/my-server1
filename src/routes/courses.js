const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const DEFAULT_TRIAL_MINUTES = 10;

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

async function resolveEntryFile(course) {
  const currentEntry = String(course?.entry_file || "").trim();
  if (/\.html?$/i.test(currentEntry)) return currentEntry;
  if (!course?.current_version_id) return currentEntry;
  const { data: version, error } = await supabase
    .from("course_versions")
    .select("manifest")
    .eq("id", course.current_version_id)
    .maybeSingle();
  if (error) throw error;
  const files = Array.isArray(version?.manifest?.files) ? version.manifest.files : [];
  return files.find((file) => String(file).toLowerCase() === "index.html")
    || files.find((file) => String(file).toLowerCase().endsWith("/index.html"))
    || currentEntry;
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
      if (!category) return res.json({ ok: true, courses: [] });
      query = query.eq("category_id", category.id);
    }

    const { data, error } = await query;
    if (error) throw error;
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
    res.json({ ok: true, course: publicCourse(course) });
  } catch (e) {
    accessError(res, e);
  }
});

// GET /api/courses/:courseId/access — authoritative entitlement/trial state.
router.get("/:courseId/content-token", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى محتوى هذا الكورس." });
    const entryFile = await resolveEntryFile(course);
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
router.post("/:courseId/trial/start", requireAuth, async (req, res) => {
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
router.post("/:courseId/quizzes/:quizId/submit", requireAuth, async (req, res) => {
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

// POST /api/courses/:courseId/projects/:projectId/submit — central project submission.
router.post("/:courseId/projects/:projectId/submit", requireAuth, async (req, res) => {
  try {
    const course = await findPublishedCourse(req.params.courseId);
    if (!course) return res.status(404).json({ ok: false, error: "الكورس غير موجود." });
    const access = await getAccess(req.userId, course.id);
    if (!access.canAccess) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذا الكورس." });
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ ok: false, error: "المشروع فارغ." });
    let projectQuery = supabase.from("projects").select("id, project_key, title").eq("course_id", course.id);
    projectQuery = findByIdOrKey(projectQuery, req.params.projectId, "project_key");
    const { data: project, error: projectError } = await projectQuery.maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, error: "المشروع غير موجود." });
    const { data: user, error: userError } = await supabase.from("users").select("email").eq("id", req.userId).maybeSingle();
    if (userError) throw userError;
    const { data: submission, error } = await supabase.from("project_submissions").insert({
      user_id: req.userId,
      email: user?.email || "",
      course_id: course.id,
      project_id: project.id,
      content: text,
      status: "submitted",
    }).select("id, course_id, project_id, status, submitted_at").single();
    if (error) throw error;
    res.status(201).json({ ok: true, submission });
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
    const { data, error } = await supabase.from("project_submissions").select("id, status, score, feedback, submitted_at").eq("user_id", req.userId).eq("course_id", course.id).eq("project_id", project.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
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
      supabase.from("quiz_attempts").select("quiz_id, passed").eq("user_id", req.userId).eq("course_id", course.id).eq("passed", true),
      supabase.from("project_submissions").select("project_id, status, score").eq("user_id", req.userId).eq("course_id", course.id).in("status", ["completed", "approved", "passed"]),
    ]);
    if (progressError || attemptsError || submissionsError) throw progressError || attemptsError || submissionsError;

    const completedLessonIds = new Set((progress || []).filter((item) => item.completed).map((item) => item.lesson_id));
    const passedQuizIds = new Set((attempts || []).map((item) => item.quiz_id));
    const completedProjectIds = new Set((submissions || []).map((item) => item.project_id));
    const lessonsOk = !lessonIds.length || lessonIds.every((id) => completedLessonIds.has(id));
    const quizzesOk = !(quizzes || []).length || (quizzes || []).every((quiz) => passedQuizIds.has(quiz.id));
    const projectsOk = !(projects || []).length || (projects || []).every((project) => completedProjectIds.has(project.id));
    if (!lessonsOk || !quizzesOk || !projectsOk) return res.status(403).json({ ok: false, error: "لم تستوفِ شروط الشهادة بعد.", requirements: { lessons: lessonsOk, quizzes: quizzesOk, projects: projectsOk } });

    const { data: existing, error: existingError } = await supabase.from("certificates").select("certificate_number, verification_code, issued_at, course_id").eq("user_id", req.userId).eq("course_id", course.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.json({ ok: true, certificate: existing });
    const certificate = {
      user_id: req.userId,
      course_id: course.id,
      certificate_number: `QL-${course.id}-${req.userId}-${Date.now()}`,
      verification_code: crypto.randomBytes(16).toString("hex"),
    };
    const { data: created, error } = await supabase.from("certificates").insert(certificate).select("certificate_number, verification_code, issued_at, course_id").single();
    if (error) throw error;
    res.status(201).json({ ok: true, certificate: created });
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
