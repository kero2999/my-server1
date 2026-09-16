const supabase = require("./db");

const { getCountryConfig, getCourseVariants, normalizeCountryCode } = require("./country-service");
const { getGraduationProjectBrief, validateGraduationProjectBrief } = require("./graduation-project-briefs");
const { getChapterProjectBrief } = require("./chapter-projects");

const PASSED_PROJECT_STATUSES = new Set(["passed", "approved", "completed"]);

function chapterNumber(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "index" || normalized === "index.html") return 1;
  const match = normalized.match(/(?:quiz-|ch(?:apter)?-?)(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function quizQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question) => ({
    q: String(question.q || question.question || question.prompt || ""),
    options: Array.isArray(question.options) ? question.options.map((option) => String(option)) : [],
  })).filter((question) => question.q && question.options.length >= 2);
}
function buildCurrentChapterTask(courseSlug, chapterNumber, title, questions) {
  const stems = quizQuestions(questions).slice(0, 3).map((question, index) => `${index + 1}) ${question.q}`).join("\n");
  const brief = getChapterProjectBrief(courseSlug, chapterNumber);
  return `Brief الحالة التطبيقية:\n${brief}\n\nالمطلوب منك في فصل «${title}»:\nطبّق فكرة هذا الفصل فقط على الحالة أعلاه. اكتب ماذا ستفعل، ولماذا، وكيف ستعرف أن النتيجة جيدة. لا تكتفِ بالتعريف النظري؛ قدّم قرارًا أو مثالًا أو مقياسًا عمليًا.\n\nمفاهيم هذا الفصل التي تساعدك:\n${stems || "المفاهيم الأساسية الواردة في شرح الفصل"}`;
}

function bestAttempt(attempts) {
  if (!attempts.length) return null;
  return attempts.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || new Date(b.attempted_at) - new Date(a.attempted_at))[0];
}

async function loadChapterAssessments(userId, courseId) {
  const { data, error } = await supabase
    .from("chapter_assessments")
    .select("id, chapter_number, attempt_number, template_score, template_feedback, questions, answers, understanding_score, understanding_feedback, chapter_score, quiz_score, passed, strengths, weaknesses, final_feedback, status, created_at, updated_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || /chapter_assessments/i.test(error.message || "")) return null;
    throw error;
  }
  return data || [];
}

async function isChapterUnlocked(userId, courseId, chapter) {
  const n = Number(chapter);
  if (!Number.isFinite(n) || n <= 1) return { unlocked: true, requiredQuiz: null };
  const requiredKey = `quiz-${n - 1}`;
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, quiz_key, title")
    .eq("course_id", courseId)
    .eq("quiz_key", requiredKey)
    .maybeSingle();
  if (quizError) throw quizError;
  if (!quiz) return { unlocked: true, requiredQuiz: null };
  const { data: passedAttempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("id, score, attempted_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("quiz_id", quiz.id)
    .eq("passed", true)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError) throw attemptError;
  const { data: assessment, error: assessmentError } = await supabase
    .from("chapter_assessments")
    .select("passed")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("chapter_number", n - 1)
    .eq("passed", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assessmentError && assessmentError.code !== "42P01" && !/chapter_assessments/i.test(assessmentError.message || "")) throw assessmentError;
  return { unlocked: assessmentError ? Boolean(passedAttempt) : Boolean(assessment || passedAttempt && false), requiredQuiz: quiz };
}

function chapterCountryContext(course, lessonLocal, resolvedCountry, chapterNumber) {
  if (["marketing-mastery", "marketing-leadership"].includes(String(course?.slug || "").trim().toLowerCase())) return "";
  return lessonLocal?.summary || lessonLocal?.market_examples || resolvedCountry?.lessonContexts?.[chapterNumber] || "";
}

async function buildLearning({ userId, course, access, country, preview = false }) {
  const [lessonsResult, quizzesResult, projectsResult, progressResult, attemptsResult, submissionsResult, userResult] = await Promise.all([
    supabase.from("lessons").select("id, lesson_key, title, position, is_preview").eq("course_id", course.id).order("position", { ascending: true }),
    supabase.from("quizzes").select("id, quiz_key, title, passing_score, questions").eq("course_id", course.id).order("id", { ascending: true }),
    supabase.from("projects").select("id, project_key, title, instructions, passing_score").eq("course_id", course.id).order("id", { ascending: true }),
    supabase.from("course_progress").select("lesson_key, progress, completed, last_position, updated_at").eq("user_id", userId).eq("course_id", course.id),
    supabase.from("quiz_attempts").select("id, quiz_id, score, passed, attempted_at").eq("user_id", userId).eq("course_id", course.id),
    supabase.from("project_submissions").select("id, project_id, status, score, feedback, ai_evaluation, evaluated_at, submitted_at").eq("user_id", userId).eq("course_id", course.id).order("submitted_at", { ascending: false }),
    supabase.from("users").select("id, full_name, email").eq("id", userId).maybeSingle(),
  ]);
  const firstError = [lessonsResult, quizzesResult, projectsResult, progressResult, attemptsResult, submissionsResult, userResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const lessons = lessonsResult.data || [];
  const quizzes = quizzesResult.data || [];
  const projects = projectsResult.data || [];
  const resolvedCountry = country || await getCountryConfig("EG");
  const variants = await getCourseVariants(course.id, resolvedCountry.countryCode);
  const lessonVariant = (lesson) => variants.lessons.get(lesson.lesson_key) || null;
  const quizVariant = (quiz) => variants.quizzes.get(quiz.quiz_key) || null;
  const projectVariant = (project) => variants.projects.get(project.project_key) || null;
  const progress = progressResult.data || [];
  const attempts = attemptsResult.data || [];
  const submissions = submissionsResult.data || [];
  const chapterAssessments = await loadChapterAssessments(userId, course.id);
  const assessmentSystemEnabled = Array.isArray(chapterAssessments);
  const latestAssessmentByChapter = new Map();
  (chapterAssessments || []).forEach((item) => {
    if (!latestAssessmentByChapter.has(Number(item.chapter_number))) latestAssessmentByChapter.set(Number(item.chapter_number), item);
  });
  const quizByKey = new Map(quizzes.map((quiz) => [quiz.quiz_key, quiz]));
  const attemptsByQuiz = new Map();
  attempts.forEach((attempt) => {
    const list = attemptsByQuiz.get(attempt.quiz_id) || [];
    list.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, list);
  });

  const maxChapter = Math.max(
    1,
    ...lessons.map((lesson) => chapterNumber(lesson.lesson_key)),
    ...quizzes.map((quiz) => chapterNumber(quiz.quiz_key)),
  );
  const chapters = [];
  for (let n = 1; n <= maxChapter; n += 1) {
    const lesson = lessons.find((item) => chapterNumber(item.lesson_key) === n) || null;
    const quiz = quizByKey.get(`quiz-${n}`) || quizzes.find((item) => chapterNumber(item.quiz_key) === n) || null;
    const lessonLocal = lesson ? lessonVariant(lesson) : null;
    const quizLocal = quiz ? quizVariant(quiz) : null;
    const preserveUploadedCourseTitles = ['marketing-launch', 'marketing-growth', 'marketing-mastery'].includes(String(course.slug || '').trim().toLowerCase());
    const attempt = quiz ? bestAttempt(attemptsByQuiz.get(quiz.id) || []) : null;
    const previous = chapters[n - 2];
    const assessment = latestAssessmentByChapter.get(n) || null;
    const unlocked = Boolean(access?.admin) || n === 1 || Boolean(previous && (assessmentSystemEnabled ? previous.assessment?.passed : previous.result?.passed));
    const lessonProgress = lesson ? progress.find((item) => item.lesson_key === lesson.lesson_key) : null;
    chapters.push({
      number: n,
      lessonKey: lesson ? lesson.lesson_key : `ch${n}`,
      title: preserveUploadedCourseTitles
        ? (lesson?.title || quiz?.title || `الفصل ${n}`)
        : (lessonLocal?.title || quizLocal?.title || lesson?.title || quiz?.title || `الفصل ${n}`),
      countryContext: chapterCountryContext(course, lessonLocal, resolvedCountry, n),
      position: lesson?.position || n,
      isPreview: Boolean(lesson?.is_preview),
      unlocked,
      completed: assessmentSystemEnabled ? Boolean(assessment?.passed) : Boolean(attempt?.passed),
      assessment: assessment ? {
        id: assessment.id,
        attemptNumber: assessment.attempt_number,
        templateScore: Number(assessment.template_score || 0),
        understandingScore: Number(assessment.understanding_score || 0),
        chapterScore: Number(assessment.chapter_score || 0),
        passed: Boolean(assessment.passed),
        status: assessment.status,
        feedback: assessment.understanding_feedback || assessment.template_feedback || "",
        strengths: Array.isArray(assessment.strengths) ? assessment.strengths : [],
        weaknesses: Array.isArray(assessment.weaknesses) ? assessment.weaknesses : [],
        finalFeedback: assessment.final_feedback || assessment.understanding_feedback || assessment.template_feedback || "",
      } : null,
      practicalTask: `${buildCurrentChapterTask(course.slug, n, lesson?.title || quiz?.title || `الفصل ${n}`, quiz?.questions)}\n\nالحالة المختارة لهذا الفصل:\n${getChapterProjectBrief(course.slug, n)}`,

      chapterScoreRequired: 75,
      progress: Number(lessonProgress?.progress || 0),
      lessonCompleted: Boolean(lessonProgress?.completed),
      quiz: quiz ? {
        id: quiz.id,
        quizKey: quiz.quiz_key,
        title: preserveUploadedCourseTitles ? quiz.title : (quizLocal?.title || quiz.title),
        passingScore: Number(quiz.passing_score || 70),
        questionCount: quizQuestions(quizLocal?.questions || quiz.questions).length,
        requiredCorrect: Math.ceil((quizQuestions(quizLocal?.questions || quiz.questions).length * Number(quiz.passing_score || 70)) / 100),
        scenarioContext: quizLocal?.scenario_context || resolvedCountry.quizContexts?.[n] || "",
        questions: quizQuestions(quizLocal?.questions || quiz.questions),
      } : null,
      result: attempt ? {
        score: Number(attempt.score || 0),
        passed: Boolean(attempt.passed),
        attemptedAt: attempt.attempted_at,
      } : null,
    });
  }

  const project = projects[0] || null;
  const projectDefinition = getGraduationProjectBrief(course);
  const projectBriefValidation = validateGraduationProjectBrief(projectDefinition, chapters.length);
  const latestSubmission = project ? submissions.find((submission) => submission.project_id === project.id) || null : null;
  const allQuizzesPassed = chapters.length > 0 && chapters.every((chapter) => chapter.quiz && chapter.result?.passed);
  const allChaptersPassed = chapters.length > 0 && (assessmentSystemEnabled ? chapters.every((chapter) => Boolean(chapter.assessment?.passed)) : chapters.every((chapter) => Boolean(chapter.result?.passed)));
  const quizScores = chapters.map((chapter) => chapter.result?.score).filter((score) => Number.isFinite(score));
  const quizAverage = quizScores.length ? Math.round((quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) * 100) / 100 : 0;
  const projectPassed = Boolean(latestSubmission && PASSED_PROJECT_STATUSES.has(latestSubmission.status));

  return {
    course: { ...course, countryCode: resolvedCountry.countryCode, countryName: resolvedCountry.countryName, countryLocale: resolvedCountry.locale, countryCurrency: resolvedCountry.currency, countryCurrencySymbol: resolvedCountry.currencySymbol },
    country: {
      countryCode: resolvedCountry.countryCode,
      countryName: resolvedCountry.countryName,
      locale: resolvedCountry.locale,
      currency: resolvedCountry.currency,
      currencySymbol: resolvedCountry.currencySymbol,
    },
    access,
    student: userResult.data || null,
    chapters,
    overall: {
      completedChapters: chapters.filter((chapter) => chapter.completed).length,
      totalChapters: chapters.length,
      quizAverage,
      allQuizzesPassed,
      allChaptersPassed,
      assessmentSystemEnabled,
    },
    project: project ? {
      id: project.id,
      projectKey: project.project_key,
      title: projectVariant(project)?.title || projectDefinition?.title || project.title,
      instructions: [projectDefinition?.instructions || project.instructions, projectVariant(project)?.instructions || resolvedCountry.projectContext].filter(Boolean).join("\n\n"),
      brief: projectDefinition?.brief || null,
      deliverables: projectDefinition?.deliverables || [],
      rubric: projectDefinition?.rubric || [],
      briefVersion: projectDefinition?.version || null,
      briefValidation: projectBriefValidation,
      passingScore: project.passing_score == null ? 70 : Number(project.passing_score),
      ready: Boolean(preview || access?.admin || allChaptersPassed),
      preview: Boolean(preview),
      passed: projectPassed,
      submission: latestSubmission,
    } : null,
    preview: Boolean(preview),
    certificateReady: Boolean(!preview && access?.enrolled && allQuizzesPassed && projectPassed),
  };
}

async function evaluateProject({ course, project, student, text }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("AI_EVALUATOR_NOT_CONFIGURED");
    error.code = "AI_EVALUATOR_NOT_CONFIGURED";
    throw error;
  }
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const rubricText = Array.isArray(project.rubric) && project.rubric.length
    ? project.rubric.map((item) => `- ${item.title}: ${item.points} نقطة — ${item.description}`).join("\n")
    : "استخدم المعايير العامة لفهم الحالة والتطبيق والاستراتيجية والوضوح.";
  const deliverablesText = Array.isArray(project.deliverables) && project.deliverables.length
    ? project.deliverables.map((item) => `- ${item.title}: ${item.description}`).join("\n")
    : "راجع تعليمات المشروع وحدد المخرجات المطلوبة منها.";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 900,
      messages: [
        {
          role: "system",
          content: "أنت مقيّم أكاديمي عادل لمشاريع تخرج في التسويق. قيّم النص المقدم فقط مقابل Brief المشروع ومخرجاته وRubric التقييم. لا تمنح درجة نجاح لمجرد أن النص طويل أو يحتوي كلمات تسويقية عامة. تحقق من منطق الخطة وملاءمتها للميزانية والمدة وبيانات الحالة. وزّع الدرجات بحيث تكون understanding من 25 وapplication من 30 وstrategy من 25 وclarity من 20، ويكون مجموعها هو score. أعد JSON مطابقًا للمخطط فقط، باللغة العربية البسيطة.",
        },
        {
          role: "user",
          content: `الكورس: ${course.title}\nعنوان المشروع: ${project.title}\nتعليمات المشروع:\n${project.instructions}\n\nمعلومات الحالة الافتراضية:\n${JSON.stringify(project.brief || {}, null, 2)}\n\nالمخرجات المطلوبة:\n${deliverablesText}\n\nRubric التقييم:\n${rubricText}\n\nدرجة النجاح: ${project.passing_score || 70}\nاسم الطالب: ${student?.full_name || "الطالب"}\n\nمشروع الطالب:\n${text}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "graduation_project_evaluation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "number", minimum: 0, maximum: 100 },
              feedback: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              criteria: {
                type: "object",
                properties: {
                  understanding: { type: "number", minimum: 0, maximum: 25 },
                  application: { type: "number", minimum: 0, maximum: 30 },
                  strategy: { type: "number", minimum: 0, maximum: 25 },
                  clarity: { type: "number", minimum: 0, maximum: 20 },
                },
                required: ["understanding", "application", "strategy", "clarity"],
                additionalProperties: false,
              },
            },
            required: ["score", "feedback", "strengths", "improvements", "criteria"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("AI project evaluation error:", data);
    const error = new Error("AI_EVALUATOR_UPSTREAM_ERROR");
    error.code = "AI_EVALUATOR_UPSTREAM_ERROR";
    throw error;
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_EVALUATOR_EMPTY_RESPONSE");
  const evaluation = JSON.parse(content);
  const score = Math.max(0, Math.min(100, Math.round(Number(evaluation.score || 0) * 100) / 100));
  return { ...evaluation, score, model };
}

module.exports = {
  PASSED_PROJECT_STATUSES,
  chapterCountryContext,
  buildLearning,
  evaluateProject,
  isChapterUnlocked,
};
